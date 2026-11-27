import { useEffect, useRef, useState } from 'react';
import { AbilityId } from './types';
import { audio } from './audio';

export type ControllerFamily = 'xbox' | 'playstation' | 'nintendo';

export interface ControllerPrompts {
  family: ControllerFamily;
  label: string;
  shortLabel: string;
  move: string;
  jump: string;
  confirm: string;
  cancel: string;
  fire: string;
  dash: string;
  bounce: string;
  pause: string;
}

export interface GamepadStatus {
  connected: boolean;
  family: ControllerFamily | null;
  prompts: ControllerPrompts | null;
  id: string;
}

export type RumblePreset = 'stomp' | 'dash' | 'bounce' | 'hurt' | 'heal' | 'rescue' | 'lock';

export interface MenuGamepadEvent {
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  confirm: boolean;
  cancel: boolean;
  pause: boolean;
}

export interface GameplayGamepadState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  firePressed: boolean;
  dashPressed: boolean;
  downPressed: boolean;
  pausePressed: boolean;
}

const PROMPTS_BY_FAMILY: Record<ControllerFamily, ControllerPrompts> = {
  xbox: {
    family: 'xbox',
    label: 'Xbox Controller',
    shortLabel: 'Xbox',
    move: 'Stick / D-Pad',
    jump: 'A',
    confirm: 'A',
    cancel: 'B',
    fire: 'X',
    dash: 'B / RB',
    bounce: 'Down / Y',
    pause: 'Start',
  },
  playstation: {
    family: 'playstation',
    label: 'PlayStation',
    shortLabel: 'PlayStation',
    move: 'Stick / D-Pad',
    jump: '✕',
    confirm: '✕',
    cancel: '○',
    fire: '□',
    dash: '○ / R1',
    bounce: 'Down / △',
    pause: 'Options',
  },
  nintendo: {
    family: 'nintendo',
    label: 'Nintendo',
    shortLabel: 'Nintendo',
    move: 'Stick / D-Pad',
    jump: 'B',
    confirm: 'A',
    cancel: 'B',
    fire: 'Y',
    dash: 'A / R',
    bounce: 'Down / X',
    pause: '+',
  },
};

export function detectControllerFamily(id: string): ControllerFamily {
  const lower = id.toLowerCase();
  if (
    lower.includes('dualshock') ||
    lower.includes('dualsense') ||
    lower.includes('playstation') ||
    lower.includes('sony') ||
    lower.includes('054c') ||
    lower.includes('ps4') ||
    lower.includes('ps5') ||
    lower.includes('wireless controller')
  ) {
    return 'playstation';
  }
  if (
    lower.includes('nintendo') ||
    lower.includes('switch') ||
    lower.includes('pro controller') ||
    lower.includes('joy-con') ||
    lower.includes('joycon') ||
    lower.includes('057e')
  ) {
    return 'nintendo';
  }
  return 'xbox';
}

export function getControllerPrompts(family: ControllerFamily | null): ControllerPrompts | null {
  return family ? PROMPTS_BY_FAMILY[family] : null;
}

export function getAbilityControlHint(
  abilityId: AbilityId,
  prompts: ControllerPrompts | null,
  keyboardFallback: string
): string {
  if (!prompts) return keyboardFallback;
  switch (abilityId) {
    case 'wing_flutter':
      return `Hold ${prompts.jump} in air`;
    case 'fire_puff':
      return `Press ${prompts.fire}`;
    case 'tail_bounce':
      return `Air ${prompts.bounce}`;
    case 'ember_dash':
      return `Press ${prompts.dash}`;
    case 'flame_shield':
      return 'Passive Aura';
    case 'wall_kick':
      return `${prompts.jump} against wall`;
    case 'double_flap':
      return `Tap ${prompts.jump} in air`;
    case 'star_crown':
      return 'Golden Victory Form';
  }
}

function btnPressed(gp: Gamepad, idx: number, threshold = 0.35): boolean {
  const b = gp.buttons[idx];
  if (!b) return false;
  return b.pressed || b.value > threshold;
}

interface VibrationActuatorLike {
  playEffect?: (
    type: string,
    params: {
      startDelay?: number;
      duration: number;
      weakMagnitude: number;
      strongMagnitude: number;
    }
  ) => Promise<string> | void;
}

type StatusListener = (status: GamepadStatus) => void;
type MenuListener = (event: MenuGamepadEvent) => void;

const STICK_DEADZONE = 0.28;
const MENU_STICK_THRESHOLD = 0.52;
const DIVE_STICK_THRESHOLD = 0.65;
const MENU_REPEAT_INITIAL_MS = 300;
const MENU_REPEAT_RATE_MS = 185;

class GamepadManager {
  private status: GamepadStatus = {
    connected: false,
    family: null,
    prompts: null,
    id: '',
  };

  private activeIndex: number | null = null;
  private statusListeners = new Set<StatusListener>();
  private menuListeners = new Set<MenuListener>();
  private rafId: number | null = null;
  private started = false;

  // Previous button snapshot for frame-accurate edge detection
  private prev = {
    jump: false,
    confirm: false,
    cancel: false,
    fire: false,
    dash: false,
    bounce: false,
    pause: false,
    anyButton: false,
  };

  // Menu directional repeat tracking
  private prevDirX: -1 | 0 | 1 = 0;
  private prevDirY: -1 | 0 | 1 = 0;
  private nextRepeatX = 0;
  private nextRepeatY = 0;
  private menuSuppressUntil = 0;

  // Live gameplay state & latched edge triggers consumed by PlatformerStage
  private gameplay: GameplayGamepadState = {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    firePressed: false,
    dashPressed: false,
    downPressed: false,
    pausePressed: false,
  };

  private start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    window.addEventListener('gamepadconnected', this.handleConnectEvent);
    window.addEventListener('gamepaddisconnected', this.handleDisconnectEvent);

    const tick = (now: number) => {
      this.poll(now);
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private handleConnectEvent = (e: GamepadEvent) => {
    this.activeIndex = e.gamepad.index;
    this.syncStatus(e.gamepad);
  };

  private handleDisconnectEvent = (e: GamepadEvent) => {
    if (this.activeIndex === e.gamepad.index) {
      this.activeIndex = null;
    }
    const nextGp = this.findActiveGamepad();
    this.syncStatus(nextGp);
  };

  private findActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const list = navigator.getGamepads();
    if (!list) return null;

    if (this.activeIndex !== null) {
      const current = list[this.activeIndex];
      if (current && current.connected) return current;
    }

    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (gp && gp.connected) {
        this.activeIndex = gp.index;
        return gp;
      }
    }
    return null;
  }

  private syncStatus(gp: Gamepad | null): void {
    if (!gp) {
      if (this.status.connected) {
        this.status = { connected: false, family: null, prompts: null, id: '' };
        this.resetHeldState();
        this.notifyStatus();
      }
      return;
    }

    const family = detectControllerFamily(gp.id || '');
    if (!this.status.connected || this.status.id !== gp.id || this.status.family !== family) {
      this.status = {
        connected: true,
        family,
        prompts: PROMPTS_BY_FAMILY[family],
        id: gp.id || 'Standard Gamepad',
      };
      this.notifyStatus();
    }
  }

  private resetHeldState(): void {
    this.gameplay.left = false;
    this.gameplay.right = false;
    this.gameplay.up = false;
    this.gameplay.down = false;
    this.gameplay.jumpHeld = false;
    this.gameplay.jumpPressed = false;
    this.gameplay.firePressed = false;
    this.gameplay.dashPressed = false;
    this.gameplay.downPressed = false;
    this.gameplay.pausePressed = false;
    this.prevDirX = 0;
    this.prevDirY = 0;
    this.prev = {
      jump: false,
      confirm: false,
      cancel: false,
      fire: false,
      dash: false,
      bounce: false,
      pause: false,
      anyButton: false,
    };
  }

  private notifyStatus(): void {
    const snap = this.status;
    this.statusListeners.forEach((fn) => fn(snap));
  }

  private poll(now: number): void {
    const gp = this.findActiveGamepad();
    this.syncStatus(gp);
    if (!gp || !this.status.family) return;

    const family = this.status.family;
    const axX = gp.axes[0] ?? 0;
    const axY = gp.axes[1] ?? 0;

    // Unlock Web Audio automatically on first physical gamepad input
    const anyPressed = gp.buttons.some((b) => b.pressed || b.value > 0.5);
    if (anyPressed && !this.prev.anyButton) {
      audio.unlock();
    }
    this.prev.anyButton = anyPressed;

    // Movement (D-pad + Left Analog Stick)
    const left = btnPressed(gp, 14) || axX < -STICK_DEADZONE;
    const right = btnPressed(gp, 15) || axX > STICK_DEADZONE;
    const up = btnPressed(gp, 12) || axY < -STICK_DEADZONE;
    const down = btnPressed(gp, 13) || axY > STICK_DEADZONE;

    // Face & shoulder buttons mapped ergonomically per controller family
    const btnBottom = btnPressed(gp, 0); // Xbox A / PS Cross / Switch B
    const btnRight = btnPressed(gp, 1);  // Xbox B / PS Circle / Switch A
    const btnLeft = btnPressed(gp, 2);   // Xbox X / PS Square / Switch Y
    const btnTop = btnPressed(gp, 3);    // Xbox Y / PS Triangle / Switch X
    const btnRB = btnPressed(gp, 5);
    const btnLT = btnPressed(gp, 6, 0.45);
    const btnRT = btnPressed(gp, 7, 0.45);
    const btnStart = btnPressed(gp, 9);

    const jumpNow = btnBottom;
    const fireNow = btnLeft;
    const dashNow = btnRight || btnRB || btnRT;
    const bounceNow = btnTop || btnLT || btnPressed(gp, 13) || axY > DIVE_STICK_THRESHOLD;
    const pauseNow = btnStart;

    // Menu confirm/cancel honors Nintendo right=A(confirm), bottom=B(cancel)
    const confirmNow = family === 'nintendo' ? btnRight : btnBottom;
    const cancelNow = family === 'nintendo' ? btnBottom : btnRight;

    const jumpJustPressed = jumpNow && !this.prev.jump;
    const fireJustPressed = fireNow && !this.prev.fire;
    const dashJustPressed = dashNow && !this.prev.dash;
    const bounceJustPressed = bounceNow && !this.prev.bounce;
    const pauseJustPressed = pauseNow && !this.prev.pause;
    const confirmJustPressed = confirmNow && !this.prev.confirm;
    const cancelJustPressed = cancelNow && !this.prev.cancel;

    this.prev.jump = jumpNow;
    this.prev.fire = fireNow;
    this.prev.dash = dashNow;
    this.prev.bounce = bounceNow;
    this.prev.pause = pauseNow;
    this.prev.confirm = confirmNow;
    this.prev.cancel = cancelNow;

    // Update live gameplay snapshot & latch edges until PlatformerStage consumes them
    this.gameplay.left = left;
    this.gameplay.right = right;
    this.gameplay.up = up;
    this.gameplay.down = down;
    this.gameplay.jumpHeld = jumpNow;
    if (jumpJustPressed) this.gameplay.jumpPressed = true;
    if (fireJustPressed) this.gameplay.firePressed = true;
    if (dashJustPressed) this.gameplay.dashPressed = true;
    if (bounceJustPressed) this.gameplay.downPressed = true;
    if (pauseJustPressed) this.gameplay.pausePressed = true;

    // Menu directional repeat logic
    const rawDirX: -1 | 0 | 1 =
      btnPressed(gp, 14) || axX < -MENU_STICK_THRESHOLD
        ? -1
        : btnPressed(gp, 15) || axX > MENU_STICK_THRESHOLD
        ? 1
        : 0;
    const rawDirY: -1 | 0 | 1 =
      btnPressed(gp, 12) || axY < -MENU_STICK_THRESHOLD
        ? -1
        : btnPressed(gp, 13) || axY > MENU_STICK_THRESHOLD
        ? 1
        : 0;

    let emitDirX: -1 | 0 | 1 = 0;
    if (rawDirX === 0) {
      this.prevDirX = 0;
    } else if (rawDirX !== this.prevDirX) {
      emitDirX = rawDirX;
      this.prevDirX = rawDirX;
      this.nextRepeatX = now + MENU_REPEAT_INITIAL_MS;
    } else if (now >= this.nextRepeatX) {
      emitDirX = rawDirX;
      this.nextRepeatX = now + MENU_REPEAT_RATE_MS;
    }

    let emitDirY: -1 | 0 | 1 = 0;
    if (rawDirY === 0) {
      this.prevDirY = 0;
    } else if (rawDirY !== this.prevDirY) {
      emitDirY = rawDirY;
      this.prevDirY = rawDirY;
      this.nextRepeatY = now + MENU_REPEAT_INITIAL_MS;
    } else if (now >= this.nextRepeatY) {
      emitDirY = rawDirY;
      this.nextRepeatY = now + MENU_REPEAT_RATE_MS;
    }

    if (
      now >= this.menuSuppressUntil &&
      (emitDirX !== 0 || emitDirY !== 0 || confirmJustPressed || cancelJustPressed || pauseJustPressed)
    ) {
      const ev: MenuGamepadEvent = {
        dirX: emitDirX,
        dirY: emitDirY,
        confirm: confirmJustPressed,
        cancel: cancelJustPressed,
        pause: pauseJustPressed,
      };
      this.menuListeners.forEach((fn) => fn(ev));
    }
  }

  public getStatus(): GamepadStatus {
    this.start();
    return this.status;
  }

  public subscribeStatus(fn: StatusListener): () => void {
    this.start();
    this.statusListeners.add(fn);
    fn(this.status);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  public subscribeMenu(fn: MenuListener): () => void {
    this.start();
    this.menuListeners.add(fn);
    return () => {
      this.menuListeners.delete(fn);
    };
  }

  public suppressMenu(ms = 180): void {
    if (typeof performance !== 'undefined') {
      this.menuSuppressUntil = Math.max(this.menuSuppressUntil, performance.now() + ms);
    }
  }

  public clearGameplayEdges(): void {
    this.gameplay.jumpPressed = false;
    this.gameplay.firePressed = false;
    this.gameplay.dashPressed = false;
    this.gameplay.downPressed = false;
    this.gameplay.pausePressed = false;
  }

  public consumeGameplayState(): GameplayGamepadState {
    this.start();
    const snap: GameplayGamepadState = { ...this.gameplay };
    this.gameplay.jumpPressed = false;
    this.gameplay.firePressed = false;
    this.gameplay.dashPressed = false;
    this.gameplay.downPressed = false;
    this.gameplay.pausePressed = false;
    return snap;
  }

  private playPulse(duration: number, strongMagnitude: number, weakMagnitude: number): void {
    const gp = this.findActiveGamepad();
    if (!gp) return;
    const actuator = (gp as Gamepad & { vibrationActuator?: VibrationActuatorLike }).vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return;
    try {
      const res = actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        strongMagnitude,
        weakMagnitude,
      });
      if (res && typeof (res as Promise<string>).catch === 'function') {
        (res as Promise<string>).catch(() => {});
      }
    } catch {
      // Ignore browsers or controllers that reject rumble calls
    }
  }

  public rumble(preset: RumblePreset): void {
    if (!this.status.connected) return;
    switch (preset) {
      case 'stomp':
        this.playPulse(55, 0.14, 0.34);
        break;
      case 'dash':
        this.playPulse(85, 0.18, 0.38);
        break;
      case 'bounce':
        this.playPulse(75, 0.16, 0.35);
        break;
      case 'hurt':
        this.playPulse(170, 0.52, 0.36);
        break;
      case 'heal':
        this.playPulse(70, 0.08, 0.24);
        break;
      case 'lock':
        this.playPulse(45, 0.15, 0.22);
        break;
      case 'rescue':
        this.playPulse(110, 0.2, 0.36);
        window.setTimeout(() => {
          this.playPulse(145, 0.28, 0.45);
        }, 145);
        break;
    }
  }
}

export const gamepadManager = new GamepadManager();

export function useGamepadStatus(): GamepadStatus {
  const [status, setStatus] = useState<GamepadStatus>(() => gamepadManager.getStatus());
  useEffect(() => gamepadManager.subscribeStatus(setStatus), []);
  return status;
}

export function useGamepadMenu(handler: (ev: MenuGamepadEvent) => void, active = true): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    return gamepadManager.subscribeMenu((ev) => handlerRef.current(ev));
  }, [active]);
}
