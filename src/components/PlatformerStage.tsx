import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AbilityId, EnemyKind, StageBlueprint } from '../game/types';
import { STAGES } from '../game/stages';
import { drawCatFoodCan, drawEnemy, drawFierio, drawKitten, drawTreat } from '../game/sprites';
import { audio } from '../game/audio';
import {
  gamepadManager,
  getAbilityControlHint,
  useGamepadMenu,
  useGamepadStatus,
} from '../game/gamepad';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Flame, Heart, Map as MapIcon, Pause, Play, RotateCcw, Sparkles, Zap } from 'lucide-react';

interface PlatformerStageProps {
  stage: StageBlueprint;
  unlockedAbilities: Set<AbilityId>;
  alreadyRescued: boolean;
  pitsySaves?: number;
  onStageClear: (stageId: number, treatsCollected: number, treatsTotal: number) => void;
  onExitToMap: () => void;
}

const W = 480;
const H = 270;
const TILE = 16;

interface RuntimeEnemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  minX: number;
  maxX: number;
  alive: boolean;
  facing: 1 | -1;
}

interface RuntimePlatform {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  baseX: number;
  baseY: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  rangePx: number;
  speed: number;
}

interface Fireball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isStar: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  isHeart?: boolean;
}

interface CrumbleState {
  state: 'solid' | 'shaking' | 'gone';
  timer: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

type StageOverlay = 'none' | 'paused' | 'game_over' | 'rescued';

export const PlatformerStage: React.FC<PlatformerStageProps> = ({
  stage,
  unlockedAbilities,
  alreadyRescued,
  pitsySaves = 0,
  onStageClear,
  onExitToMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [overlay, setOverlay] = useState<StageOverlay>('none');
  const [overlayFocusIdx, setOverlayFocusIdx] = useState(0);
  const [runId, setRunId] = useState(0);
  const gamepad = useGamepadStatus();

  const hasFirePuff = unlockedAbilities.has('fire_puff');
  const hasTailBounce = unlockedAbilities.has('tail_bounce');
  const hasEmberDash = unlockedAbilities.has('ember_dash');
  const hasFlameShield = unlockedAbilities.has('flame_shield');

  const maxHearts = hasFlameShield ? 4 : 3;
  const [hudHearts, setHudHearts] = useState(maxHearts);
  const [hudTreats, setHudTreats] = useState(0);
  const [wasAlreadyRescuedOnStart, setWasAlreadyRescuedOnStart] = useState(alreadyRescued);

  const abilitiesRef = useRef(unlockedAbilities);
  abilitiesRef.current = unlockedAbilities;

  const onStageClearRef = useRef(onStageClear);
  onStageClearRef.current = onStageClear;

  useEffect(() => {
    setWasAlreadyRescuedOnStart(alreadyRescued);
  }, [stage.id, runId]);

  // Count total treats in stage
  const totalTreats = useMemo(() => {
    let count = 0;
    for (const row of stage.grid) {
      for (const ch of row) {
        if (ch === 'T') count++;
      }
    }
    return count;
  }, [stage]);

  // Keep refs for inputs & overlay so the 60fps loop stays crisp
  const keysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    firePressed: false,
    dashPressed: false,
    downPressed: false,
  });

  const overlayRef = useRef<StageOverlay>('none');
  useEffect(() => {
    overlayRef.current = overlay;
    if (overlay !== 'none') {
      setOverlayFocusIdx(0);
      gamepadManager.suppressMenu(200);
    } else {
      gamepadManager.clearGameplayEdges();
    }
  }, [overlay]);

  const restartStage = useCallback(() => {
    gamepadManager.suppressMenu(200);
    gamepadManager.clearGameplayEdges();
    setOverlay('none');
    const startMax = abilitiesRef.current.has('flame_shield') ? 4 : 3;
    setHudHearts(startMax);
    setHudTreats(0);
    setRunId((n) => n + 1);
  }, []);

  // Full gamepad navigation for Paused, Game Over, and Kitten Rescued overlays
  useGamepadMenu((ev) => {
    if (overlay === 'paused') {
      const count = 3;
      const delta = ev.dirY !== 0 ? ev.dirY : ev.dirX;
      if (delta !== 0) {
        audio.playFootstep();
        setOverlayFocusIdx((i) => (i + delta + count) % count);
      } else if (ev.cancel || ev.pause) {
        gamepadManager.suppressMenu(220);
        setOverlay('none');
      } else if (ev.confirm) {
        gamepadManager.suppressMenu(220);
        if (overlayFocusIdx === 0) setOverlay('none');
        else if (overlayFocusIdx === 1) restartStage();
        else onExitToMap();
      }
    } else if (overlay === 'game_over') {
      const delta = ev.dirX !== 0 ? ev.dirX : ev.dirY;
      if (delta !== 0) {
        audio.playFootstep();
        setOverlayFocusIdx((i) => (i === 0 ? 1 : 0));
      } else if (ev.cancel) {
        gamepadManager.suppressMenu(220);
        onExitToMap();
      } else if (ev.confirm || ev.pause) {
        gamepadManager.suppressMenu(220);
        if (overlayFocusIdx === 0) restartStage();
        else onExitToMap();
      }
    } else if (overlay === 'rescued') {
      const delta = ev.dirX !== 0 ? ev.dirX : ev.dirY;
      if (delta !== 0) {
        audio.playFootstep();
        setOverlayFocusIdx((i) => (i === 0 ? 1 : 0));
      } else if (ev.cancel) {
        gamepadManager.suppressMenu(220);
        onExitToMap();
      } else if (ev.confirm || ev.pause) {
        gamepadManager.suppressMenu(220);
        if (overlayFocusIdx === 0) onExitToMap();
        else restartStage();
      }
    }
  }, overlay !== 'none');

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (overlayRef.current === 'none') setOverlay('paused');
        else if (overlayRef.current === 'paused') setOverlay('none');
        return;
      }
      if (overlayRef.current !== 'none') return;

      const k = keysRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        k.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        k.right = true;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (!k.jumpHeld) k.jumpPressed = true;
        k.jumpHeld = true;
        k.up = true;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!k.down) k.downPressed = true;
        k.down = true;
      } else if (e.key === 'x' || e.key === 'X' || e.key === 'j' || e.key === 'J' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        k.firePressed = true;
      } else if (e.key === 'Shift' || e.key === 'c' || e.key === 'C' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        k.dashPressed = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = false;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = false;
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        k.jumpHeld = false;
        k.up = false;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') k.down = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Main 60fps Fixed-Timestep 8-Bit Platformer Simulation & Renderer
  useEffect(() => {
    audio.startBgm('stage');

    const ab = abilitiesRef.current;
    const effWingFlutter = ab.has('wing_flutter');
    const effFirePuff = ab.has('fire_puff');
    const effTailBounce = ab.has('tail_bounce');
    const effEmberDash = ab.has('ember_dash');
    const effFlameShield = ab.has('flame_shield');
    const effWallKick = ab.has('wall_kick');
    const effDoubleFlap = ab.has('double_flap');
    const effStarCrown = ab.has('star_crown');
    const startMaxHearts = effFlameShield ? 4 : 3;

    const rows = stage.grid.length;
    const cols = stage.grid[0].length;
    const mapWidthPx = cols * TILE;

    // Parse spawn, kitten goal, treats, and crumbling domino bricks
    let spawnX = 64;
    let spawnY = 200;
    let kittenX = (cols - 5) * TILE;
    let kittenY = 140;

    const treats: { x: number; y: number; collected: boolean }[] = [];
    const foodCans: { x: number; y: number; collected: boolean }[] = [];
    const crumbles = new Map<string, CrumbleState>();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = stage.grid[r][c];
        if (ch === 'P') {
          spawnX = c * TILE + TILE / 2;
          spawnY = (r + 1) * TILE;
        } else if (ch === 'K') {
          kittenX = c * TILE + TILE / 2;
          kittenY = (r + 1) * TILE;
        } else if (ch === 'T') {
          treats.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, collected: false });
        } else if (ch === 'F') {
          foodCans.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, collected: false });
        } else if (ch === 'D') {
          crumbles.set(`${c},${r}`, { state: 'solid', timer: 0 });
        }
      }
    }

    const enemies: RuntimeEnemy[] = stage.enemies.map((e, i) => ({
      id: i,
      kind: e.kind,
      x: e.tileX * TILE + TILE / 2,
      y: (e.tileY + 1) * TILE,
      vx: e.speed,
      minX: e.patrolMinX * TILE + 8,
      maxX: e.patrolMaxX * TILE + 8,
      alive: true,
      facing: 1,
    }));

    const platforms: RuntimePlatform[] = stage.movingPlatforms.map((p) => ({
      x: p.tileX * TILE,
      y: p.tileY * TILE,
      prevX: p.tileX * TILE,
      prevY: p.tileY * TILE,
      baseX: p.tileX * TILE,
      baseY: p.tileY * TILE,
      w: p.widthTiles * TILE,
      h: 8,
      axis: p.axis,
      rangePx: p.rangeTiles * TILE,
      speed: p.speed,
    }));

    const fireballs: Fireball[] = [];
    const particles: Particle[] = [];
    const floatingTexts: FloatingText[] = [];

    const player = {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      w: 16,
      h: 26,
      facing: 1 as 1 | -1,
      grounded: false,
      coyoteTimer: 0,
      jumpBuffer: 0,
      flutterTime: 0,
      fluttering: false,
      flutterSfxTimer: 0,
      airJumpUsed: false,
      dashUsed: false,
      dashTimer: 0,
      fireCooldown: 0,
      tailBouncing: false,
      wallDir: 0 as -1 | 0 | 1,
      invulnTimer: 0,
      respawnLockTimer: 0,
      respawnHeldDir: 0 as -1 | 0 | 1,
      hearts: startMaxHearts,
      treatsCollected: 0,
      lastSafeX: spawnX,
      lastSafeY: spawnY,
    };

    let rescueAnimating = false;
    let rescueTimer = 0;
    let camX = Math.max(0, Math.min(mapWidthPx - W, player.x - W * 0.35));
    let elapsed = 0;
    let frame = 0;
    let shakeTimer = 0;

    setHudHearts(startMaxHearts);
    setHudTreats(0);

    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 60,
      isHeart = false
    ) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const mag = speed * (0.4 + Math.random() * 0.8);
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * mag,
          vy: isHeart ? -28 - Math.random() * 42 : Math.sin(ang) * mag - 20,
          color,
          size: isHeart ? 5 : 2 + Math.floor(Math.random() * 2),
          life: isHeart ? 1.15 : 0.35 + Math.random() * 0.25,
          maxLife: isHeart ? 1.15 : 0.6,
          isHeart,
        });
      }
    };

    const getTile = (c: number, r: number): string => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return '.';
      const ch = stage.grid[r][c];
      if (ch === 'D') {
        const st = crumbles.get(`${c},${r}`);
        if (st && st.state === 'gone') return '.';
      }
      return ch;
    };

    const isSolid = (c: number, r: number): boolean => {
      const ch = getTile(c, r);
      return ch === '#' || ch === '=' || ch === 'B';
    };

    const isOneWay = (c: number, r: number): boolean => {
      const ch = getTile(c, r);
      return ch === '-' || ch === 'D';
    };

    const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
      floatingTexts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
    };

    const hasFloorAt = (worldX: number, footY: number): boolean => {
      const col = Math.floor(worldX / TILE);
      const footRow = Math.floor((footY + 2) / TILE);
      if (isSolid(col, footRow) || isOneWay(col, footRow)) return true;
      for (const p of platforms) {
        if (worldX >= p.x && worldX <= p.x + p.w && Math.abs(footY - p.y) <= 4) {
          return true;
        }
      }
      return false;
    };

    const hasGroundBelow = (worldX: number, startY: number): boolean => {
      const col = Math.floor(worldX / TILE);
      const startRow = Math.max(0, Math.floor(startY / TILE));
      for (let r = startRow; r < rows; r++) {
        if (isSolid(col, r) || isOneWay(col, r)) return true;
      }
      for (const p of platforms) {
        if (worldX >= p.x && worldX <= p.x + p.w && p.y >= startY - 4) {
          return true;
        }
      }
      return false;
    };

    const isSafeFloorTile = (c: number, r: number): boolean => {
      const ch = getTile(c, r);
      if (ch !== '#' && ch !== '=') return false;
      if (isSolid(c, r - 1) || isSolid(c, r - 2)) return false;
      if (getTile(c, r - 1) === '^') return false;
      return true;
    };

    const resolveSafeRespawnPos = (preferredX: number, preferredY: number): { x: number; y: number } => {
      const prefCol = Math.floor(preferredX / TILE);
      const footRow = Math.floor((preferredY + 2) / TILE);
      if (
        isSafeFloorTile(prefCol - 1, footRow) &&
        isSafeFloorTile(prefCol, footRow) &&
        isSafeFloorTile(prefCol + 1, footRow)
      ) {
        return { x: prefCol * TILE + TILE / 2, y: footRow * TILE };
      }
      for (let offset = 1; offset <= 6; offset++) {
        for (const dir of [-1, 1]) {
          const c = prefCol + dir * offset;
          if (isSafeFloorTile(c - 1, footRow) && isSafeFloorTile(c, footRow) && isSafeFloorTile(c + 1, footRow)) {
            return { x: c * TILE + TILE / 2, y: footRow * TILE };
          }
        }
      }
      return { x: spawnX, y: spawnY };
    };

    const hurtPlayer = (knockDir: number) => {
      if (player.invulnTimer > 0 || rescueAnimating) return;
      player.hearts = Math.max(0, player.hearts - 1);
      setHudHearts(player.hearts);
      player.invulnTimer = 2.0; // Momentary 2-second invincibility grace period
      // Zero horizontal launch velocity so a side hit never throws Fierio across/into a pit
      player.vx = 0;
      player.vy = player.grounded ? 0 : Math.max(0, player.vy);
      player.tailBouncing = false;
      player.dashTimer = 0;

      // Tiny safe horizontal recoil (max 4px) that never enters a wall or steps over a pit
      const dir = knockDir < 0 ? -1 : 1;
      const halfW = player.w / 2;
      const topRow = Math.floor((player.y - player.h + 2) / TILE);
      const botRow = Math.floor((player.y - 2) / TILE);
      const maxNudgePx = 4;

      for (let step = 0; step < maxNudgePx; step++) {
        const nextX = player.x + dir;
        if (nextX < 10 || nextX > mapWidthPx - 10) break;

        const edgeCol = Math.floor((nextX + dir * halfW) / TILE);
        let hitsWall = false;
        for (let r = topRow; r <= botRow; r++) {
          if (isSolid(edgeCol, r)) {
            hitsWall = true;
            break;
          }
        }
        if (hitsWall) break;

        const leadingEdgeX = nextX + dir * halfW;
        const innerFootX = nextX + dir * (halfW - 2);
        if (player.grounded) {
          if (
            !hasFloorAt(nextX, player.y) ||
            !hasFloorAt(innerFootX, player.y) ||
            !hasGroundBelow(leadingEdgeX, player.y)
          ) {
            break;
          }
        } else {
          if (!hasGroundBelow(nextX, player.y) || !hasGroundBelow(leadingEdgeX, player.y)) {
            break;
          }
        }

        player.x = nextX;
      }

      shakeTimer = 0.2;
      audio.playHurt();
      gamepadManager.rumble('hurt');
      spawnParticles(player.x, player.y - 14, '#EF233C', 10, 85);
      spawnFloatingText(player.x, player.y - 34, '-1 ♥', '#FF758F');

      if (player.hearts <= 0) {
        setOverlay('game_over');
      }
    };

    const stepPhysics = (dt: number) => {
      elapsed += dt;
      frame++;
      if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);

      // Update crumbling domino bricks (wait to respawn if Fierio is overlapping so he can never get trapped)
      crumbles.forEach((st, key) => {
        if (st.state === 'shaking') {
          st.timer -= dt;
          if (st.timer <= 0) {
            st.state = 'gone';
            st.timer = 2.4;
          }
        } else if (st.state === 'gone') {
          st.timer -= dt;
          if (st.timer <= 0) {
            const [cStr, rStr] = key.split(',');
            const tx = Number(cStr) * TILE;
            const ty = Number(rStr) * TILE;
            const halfPlayerW = player.w / 2;
            const overlapsPlayer =
              player.x + halfPlayerW > tx - 4 &&
              player.x - halfPlayerW < tx + TILE + 4 &&
              player.y > ty - 4 &&
              player.y - player.h < ty + TILE + 4;
            if (!overlapsPlayer) {
              st.state = 'solid';
              st.timer = 0;
            } else {
              st.timer = 0.08;
            }
          }
        }
      });

      // Update moving platforms
      for (const p of platforms) {
        p.prevX = p.x;
        p.prevY = p.y;
        const offset = Math.sin(elapsed * p.speed) * p.rangePx;
        if (p.axis === 'x') p.x = p.baseX + offset;
        else p.y = p.baseY + offset;
      }

      // Update particles & floating combat/heal texts always
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (!pt.isHeart) pt.vy += 180 * dt;
        pt.life -= dt;
        if (pt.life <= 0) particles.splice(i, 1);
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 24 * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }

      // If rescue choreography is playing, celebrate!
      if (rescueAnimating) {
        rescueTimer += dt;
        if (frame % 10 === 0) {
          spawnParticles(kittenX, kittenY - 14, '#FB7185', 2, 35, true);
          spawnParticles(kittenX, kittenY - 14, '#FACC15', 3, 55, false);
        }
        if (rescueTimer >= 1.35) {
          setOverlay('rescued');
        }
        return;
      }

      const k = keysRef.current;
      const gp = gamepadManager.consumeGameplayState();

      if (gp.pausePressed) {
        gamepadManager.suppressMenu(240);
        setOverlay('paused');
        return;
      }

      const moveLeft = k.left || gp.left;
      const moveRight = k.right || gp.right;
      const jumpHeld = k.jumpHeld || gp.jumpHeld;
      const jumpPressed = k.jumpPressed || gp.jumpPressed;
      const firePressed = k.firePressed || gp.firePressed;
      const dashPressed = k.dashPressed || gp.dashPressed;
      const downPressed = k.downPressed || gp.downPressed;

      k.jumpPressed = false;
      k.firePressed = false;
      k.dashPressed = false;
      k.downPressed = false;

      if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
      if (player.fireCooldown > 0) player.fireCooldown = Math.max(0, player.fireCooldown - dt);
      if (player.respawnLockTimer > 0) player.respawnLockTimer = Math.max(0, player.respawnLockTimer - dt);

      const rawMoveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
      if (player.respawnHeldDir !== 0) {
        if (rawMoveDir !== player.respawnHeldDir || (jumpPressed && player.respawnLockTimer <= 0)) {
          player.respawnHeldDir = 0;
        }
      }

      if (jumpPressed && player.respawnLockTimer <= 0) {
        player.jumpBuffer = 0.11;
      } else {
        player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
      }

      // --- ABILITY 2: FIRE PUFF (Wizzle) & STAR PUFFS (Pitsy) ---
      if (firePressed && player.respawnLockTimer <= 0) {
        if (effFirePuff && player.fireCooldown <= 0) {
          fireballs.push({
            x: player.x + player.facing * 14,
            y: player.y - 17,
            vx: player.facing * (effStarCrown ? 235 : 195),
            vy: -45,
            life: 1.5,
            isStar: effStarCrown,
          });
          player.fireCooldown = effStarCrown ? 0.2 : 0.34;
          audio.playFirePuff(effStarCrown);
          spawnParticles(player.x + player.facing * 14, player.y - 17, effStarCrown ? '#FACC15' : '#F97316', 5, 55);
        }
      }

      // --- ABILITY 4: EMBER DASH (Swipey) ---
      if (dashPressed && player.respawnLockTimer <= 0) {
        if (effEmberDash && !player.dashUsed && player.dashTimer <= 0) {
          player.dashTimer = 0.2;
          player.dashUsed = !player.grounded;
          player.vx = player.facing * 245;
          player.vy = 0;
          player.tailBouncing = false;
          audio.playEmberDash();
          gamepadManager.rumble('dash');
          spawnParticles(player.x, player.y - 13, '#EF233C', 8, 70);
        }
      }

      // --- ABILITY 3: TAIL BOUNCE (D da Baller) ---
      if (downPressed && player.respawnLockTimer <= 0) {
        if (effTailBounce && !player.grounded && !player.tailBouncing && player.dashTimer <= 0) {
          player.tailBouncing = true;
          player.vy = 255;
          spawnParticles(player.x, player.y - 2, '#F59E0B', 5, 45);
        }
      }

      // Horizontal Movement
      const runSpeed = effStarCrown ? 122 : 114;
      if (player.respawnLockTimer > 0) {
        player.vx = 0;
        player.vy = 0;
      } else if (player.dashTimer > 0) {
        player.dashTimer -= dt;
        player.vy = 0;
        if (frame % 2 === 0) {
          spawnParticles(player.x - player.facing * 12, player.y - 13, '#F97316', 2, 25);
        }
      } else {
        const moveDir =
          player.respawnHeldDir !== 0 && rawMoveDir === player.respawnHeldDir ? 0 : rawMoveDir;
        if (moveDir !== 0) {
          player.facing = moveDir as 1 | -1;
          const accel = player.grounded ? 920 : 620;
          player.vx += moveDir * accel * dt;
          if (Math.abs(player.vx) > runSpeed) {
            player.vx = Math.sign(player.vx) * runSpeed;
          }
        } else {
          const friction = player.grounded ? 950 : 280;
          if (Math.abs(player.vx) <= friction * dt) player.vx = 0;
          else player.vx -= Math.sign(player.vx) * friction * dt;
        }
      }

      // Star-Fierio rainbow star trail!
      if (effStarCrown && Math.abs(player.vx) > 40 && frame % 5 === 0) {
        const colors = ['#FACC15', '#38BDF8', '#F472B6', '#4ADE80'];
        spawnParticles(player.x, player.y - 15, colors[frame % colors.length], 1, 20);
      }

      // Jump, Wall Kick, Double Flap & Wing Flutter
      const jumpPower = effStarCrown ? -255 : -242;
      if (player.grounded) {
        player.coyoteTimer = 0.11;
        player.flutterTime = 0;
        player.airJumpUsed = false;
        player.dashUsed = false;
      } else {
        player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
      }

      if (player.jumpBuffer > 0) {
        if (player.coyoteTimer > 0) {
          // Standard grounded/coyote jump
          player.vy = jumpPower;
          player.grounded = false;
          player.coyoteTimer = 0;
          player.jumpBuffer = 0;
          player.tailBouncing = false;
          audio.playJump();
          spawnParticles(player.x, player.y, '#E2E8F0', 5, 45);
        } else if (effWallKick && player.wallDir !== 0) {
          // --- ABILITY 6: WALL CLING & KICK (Mask) ---
          player.vy = jumpPower;
          player.vx = -player.wallDir * 142;
          player.facing = (-player.wallDir) as 1 | -1;
          player.jumpBuffer = 0;
          player.airJumpUsed = false;
          player.dashUsed = false;
          player.flutterTime = 0;
          player.tailBouncing = false;
          audio.playWallKick();
          spawnParticles(player.x + player.wallDir * 9, player.y - 14, '#A855F7', 7, 65);
        } else if (effDoubleFlap && !player.airJumpUsed) {
          // --- ABILITY 7: DOUBLE FLAP (Loki) ---
          player.vy = jumpPower * 0.96;
          player.airJumpUsed = true;
          player.jumpBuffer = 0;
          player.flutterTime = 0;
          player.tailBouncing = false;
          audio.playDoubleFlap();
          spawnParticles(player.x, player.y - 4, '#10B981', 8, 65);
        }
      }

      // Variable jump height cut when releasing Jump early
      if (!jumpHeld && player.vy < -105 && !player.tailBouncing) {
        player.vy *= 0.85;
      }

      // Gravity + Wing Flutter + Wall Cling slide
      player.fluttering = false;
      if (player.dashTimer <= 0) {
        player.vy += 560 * dt;

        // --- ABILITY 1: WING FLUTTER (Angelica) ---
        if (effWingFlutter && !player.grounded && jumpHeld && player.vy > 26 && player.flutterTime < 1.15 && !player.tailBouncing) {
          player.vy = Math.min(player.vy, 34);
          player.flutterTime += dt;
          player.fluttering = true;
          player.flutterSfxTimer -= dt;
          if (player.flutterSfxTimer <= 0) {
            audio.playWingFlutter();
            player.flutterSfxTimer = 0.22;
            spawnParticles(player.x - player.facing * 9, player.y - 18, '#BAE6FD', 2, 25);
          }
        }

        // --- ABILITY 6: WALL CLING slow slide ---
        if (effWallKick && !player.grounded && player.wallDir !== 0 && player.vy > 48) {
          player.vy = 48;
          if (frame % 7 === 0) {
            spawnParticles(player.x + player.wallDir * 9, player.y - 12, '#CBD5E1', 1, 18);
          }
        }

        player.vy = Math.min(player.vy, 340);
      }

      // --- HORIZONTAL COLLISION ---
      player.x += player.vx * dt;
      player.x = Math.max(10, Math.min(mapWidthPx - 10, player.x));
      player.wallDir = 0;

      const halfW = player.w / 2;
      const topRow = Math.floor((player.y - player.h + 2) / TILE);
      const botRow = Math.floor((player.y - 2) / TILE);

      if (player.vx > 0) {
        const rightCol = Math.floor((player.x + halfW) / TILE);
        for (let r = topRow; r <= botRow; r++) {
          if (isSolid(rightCol, r)) {
            player.x = rightCol * TILE - halfW - 0.01;
            player.vx = 0;
            if (!player.grounded && moveRight) player.wallDir = 1;
            break;
          }
        }
      } else if (player.vx < 0) {
        const leftCol = Math.floor((player.x - halfW) / TILE);
        for (let r = topRow; r <= botRow; r++) {
          if (isSolid(leftCol, r)) {
            player.x = (leftCol + 1) * TILE + halfW + 0.01;
            player.vx = 0;
            if (!player.grounded && moveLeft) player.wallDir = -1;
            break;
          }
        }
      } else if (!player.grounded) {
        // Check wall touch even when velocity is 0 while pressing into wall
        if (moveRight) {
          const rc = Math.floor((player.x + halfW + 1.5) / TILE);
          for (let r = topRow; r <= botRow; r++) {
            if (isSolid(rc, r)) { player.wallDir = 1; break; }
          }
        } else if (moveLeft) {
          const lc = Math.floor((player.x - halfW - 1.5) / TILE);
          for (let r = topRow; r <= botRow; r++) {
            if (isSolid(lc, r)) { player.wallDir = -1; break; }
          }
        }
      }

      // --- VERTICAL COLLISION ---
      const prevY = player.y;
      player.y += player.vy * dt;
      player.grounded = false;

      const leftCol = Math.floor((player.x - halfW + 1) / TILE);
      const rightCol = Math.floor((player.x + halfW - 1) / TILE);

      if (player.vy >= 0) {
        const footRow = Math.floor(player.y / TILE);
        let landedTile: string | null = null;

        for (let c = leftCol; c <= rightCol; c++) {
          const ch = getTile(c, footRow);
          if (isSolid(c, footRow)) {
            player.y = footRow * TILE;
            landedTile = ch;
          } else if (isOneWay(c, footRow) && prevY <= footRow * TILE + 4) {
            player.y = footRow * TILE;
            landedTile = ch;
            if (ch === 'D') {
              const st = crumbles.get(`${c},${footRow}`);
              if (st && st.state === 'solid') {
                st.state = 'shaking';
                st.timer = 0.48;
              }
            }
          }
        }

        // Moving platforms landing check
        for (const p of platforms) {
          if (
            player.x + halfW > p.x &&
            player.x - halfW < p.x + p.w &&
            prevY <= p.prevY + 5 &&
            player.y >= p.y
          ) {
            player.y = p.y;
            player.x += p.x - p.prevX;
            landedTile = 'M';
          }
        }

        if (landedTile) {
          if (landedTile === 'B') {
            // Bouncy cushion pad!
            player.vy = player.tailBouncing ? -340 : -308;
            player.grounded = false;
            player.tailBouncing = false;
            player.airJumpUsed = false;
            player.dashUsed = false;
            audio.playTailBounce();
            gamepadManager.rumble('bounce');
            spawnParticles(player.x, player.y, '#EC4899', 8, 70);
          } else if (player.tailBouncing) {
            // D da Baller's Tail Bounce super-spring off ANY floor!
            player.vy = -298;
            player.grounded = false;
            player.tailBouncing = false;
            player.airJumpUsed = false;
            player.dashUsed = false;
            audio.playTailBounce();
            gamepadManager.rumble('bounce');
            spawnParticles(player.x, player.y, '#FACC15', 10, 80);
          } else {
            player.vy = 0;
            player.grounded = true;
            if (landedTile === '#' || landedTile === '=') {
              const safeCol = Math.floor(player.x / TILE);
              const safeRow = Math.floor((player.y + 2) / TILE);
              if (
                isSafeFloorTile(safeCol - 1, safeRow) &&
                isSafeFloorTile(safeCol, safeRow) &&
                isSafeFloorTile(safeCol + 1, safeRow)
              ) {
                player.lastSafeX = safeCol * TILE + TILE / 2;
                player.lastSafeY = safeRow * TILE;
              }
            }
          }
        }
      } else {
        // Head bonk check
        const headRow = Math.floor((player.y - player.h) / TILE);
        for (let c = leftCol; c <= rightCol; c++) {
          if (isSolid(c, headRow)) {
            player.y = (headRow + 1) * TILE + player.h;
            player.vy = 0;
            break;
          }
        }
      }

      // Check Ember Hazard Tiles ('^')
      const centerCol = Math.floor(player.x / TILE);
      const bodyRow = Math.floor((player.y - 4) / TILE);
      if (getTile(centerCol, bodyRow) === '^') {
        if (effFlameShield) {
          if (frame % 8 === 0) {
            spawnParticles(player.x, player.y - 2, '#FACC15', 2, 35);
          }
        } else {
          hurtPlayer(-player.facing);
        }
      }

      // Pit fall recovery (lose 1 heart and return cleanly to safe solid ground!)
      if (player.y > H + 34) {
        player.hearts = Math.max(0, player.hearts - 1);
        setHudHearts(player.hearts);
        audio.playHurt();
        gamepadManager.rumble('hurt');
        if (player.hearts <= 0) {
          setOverlay('game_over');
        } else {
          const safePos = resolveSafeRespawnPos(player.lastSafeX, player.lastSafeY);
          player.x = safePos.x;
          player.y = safePos.y;
          player.vx = 0;
          player.vy = 0;
          player.grounded = true;
          player.coyoteTimer = 0.11;
          player.jumpBuffer = 0;
          player.invulnTimer = 1.5; // 1.5 seconds of invulnerability after pit respawn
          player.respawnLockTimer = 0.22; // Brief zero-velocity settle on safe ground
          player.respawnHeldDir = rawMoveDir as -1 | 0 | 1;
          player.tailBouncing = false;
          player.dashTimer = 0;
          player.dashUsed = false;
          player.airJumpUsed = false;
          player.flutterTime = 0;
          spawnParticles(player.x, player.y - 14, '#EF233C', 8, 65);
          spawnFloatingText(player.x, player.y - 34, '-1 ♥', '#FF758F');
        }
      }

      // Collect Golden Fish Treats
      for (const tr of treats) {
        if (!tr.collected && Math.hypot(player.x - tr.x, player.y - 14 - tr.y) < 18) {
          tr.collected = true;
          player.treatsCollected++;
          setHudTreats(player.treatsCollected);
          audio.playTreat();
          spawnParticles(tr.x, tr.y, '#FACC15', 7, 65);
        }
      }

      // Collect Health-Restoring Cans of Cat Food (+1 Heart when injured)
      for (const can of foodCans) {
        if (!can.collected && player.hearts < startMaxHearts && Math.hypot(player.x - can.x, player.y - 14 - can.y) < 20) {
          can.collected = true;
          player.hearts = Math.min(startMaxHearts, player.hearts + 1);
          setHudHearts(player.hearts);
          audio.playHeal();
          gamepadManager.rumble('heal');
          spawnParticles(can.x, can.y - 4, '#FB7185', 6, 48, true);
          spawnParticles(can.x, can.y - 4, '#86EFAC', 8, 65, false);
          spawnFloatingText(can.x, can.y - 14, '+1 ♥', '#86EFAC');
        }
      }

      // Update Fireballs
      for (let i = fireballs.length - 1; i >= 0; i--) {
        const fb = fireballs[i];
        fb.life -= dt;
        fb.vy += 420 * dt;
        fb.x += fb.vx * dt;
        fb.y += fb.vy * dt;

        const fc = Math.floor(fb.x / TILE);
        const fr = Math.floor(fb.y / TILE);
        if (isSolid(fc, fr)) {
          // Bounce gently off floor or vanish on wall
          const prevFr = Math.floor((fb.y - fb.vy * dt) / TILE);
          if (prevFr < fr) {
            fb.y = fr * TILE - 2;
            fb.vy = -125;
          } else {
            spawnParticles(fb.x, fb.y, fb.isStar ? '#FACC15' : '#F97316', 5, 50);
            fireballs.splice(i, 1);
            continue;
          }
        }

        // Hit enemies
        let hit = false;
        for (const en of enemies) {
          if (en.alive && Math.hypot(fb.x - en.x, fb.y - (en.y - 7)) < 13) {
            en.alive = false;
            hit = true;
            audio.playStomp();
            gamepadManager.rumble('stomp');
            spawnParticles(en.x, en.y - 7, fb.isStar ? '#FACC15' : '#F97316', 12, 85);
            break;
          }
        }
        if (hit || fb.life <= 0 || fb.y > H + 16) {
          fireballs.splice(i, 1);
        }
      }

      // Update Enemies & Player Collision
      for (const en of enemies) {
        if (!en.alive) continue;
        en.x += en.vx * dt;
        if (en.x <= en.minX) {
          en.x = en.minX;
          en.vx = Math.abs(en.vx);
          en.facing = 1;
        } else if (en.x >= en.maxX) {
          en.x = en.maxX;
          en.vx = -Math.abs(en.vx);
          en.facing = -1;
        }

        const dx = Math.abs(player.x - en.x);
        const dy = player.y - en.y;
        if (dx < 14 && dy > -14 && dy < 20) {
          // Stomp or Tail Bounce from above!
          if ((player.vy > 20 && player.y - 5 < en.y - 3) || player.tailBouncing) {
            en.alive = false;
            player.vy = player.tailBouncing ? -295 : -205;
            player.tailBouncing = false;
            player.airJumpUsed = false;
            player.dashUsed = false;
            shakeTimer = 0.12;
            audio.playStomp();
            gamepadManager.rumble('stomp');
            spawnParticles(en.x, en.y - 7, '#FACC15', 10, 80);
          } else if (en.kind === 'spark' && effFlameShield) {
            // Flame Shield safely deflects ember spark sprites!
            en.alive = false;
            audio.playStomp();
            gamepadManager.rumble('stomp');
            spawnParticles(en.x, en.y - 7, '#FACC15', 10, 75);
          } else {
            hurtPlayer(player.x < en.x ? -1 : 1);
          }
        }
      }

      // --- REACH THE HIDDEN KITTEN! ---
      if (Math.hypot(player.x - kittenX, player.y - 13 - (kittenY - 7)) < 23) {
        rescueAnimating = true;
        rescueTimer = 0;
        player.vx = 0;
        player.vy = 0;
        // Kitten meows happily + 16-bit rescue fanfare + celebratory gentle rumble!
        audio.playRescueFanfare(stage.kitten.meowPitch);
        gamepadManager.rumble('rescue');
        spawnParticles(kittenX, kittenY - 12, '#FB7185', 8, 55, true);
        spawnParticles(kittenX, kittenY - 12, '#FACC15', 12, 85, false);
        onStageClearRef.current(stage.id, player.treatsCollected, totalTreats);
      }

      // Smooth camera tracking
      const targetCam = Math.max(0, Math.min(mapWidthPx - W, player.x - W * 0.4 + player.facing * 24));
      camX += (targetCam - camX) * Math.min(1, dt * 7);
    };

    const drawScene = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      const pal = stage.palette;
      const shakeX = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 5) : 0;
      const shakeY = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;

      // --- 16-BIT MULTI-STOP ATMOSPHERIC SKY GRADIENT ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, pal.skyTop);
      skyGrad.addColorStop(0.68, pal.skyBottom);
      skyGrad.addColorStop(1, pal.isNight ? '#0B0E17' : pal.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Luminous Sun or Crescent Moon with concentric 16-bit atmospheric halo
      const orbX = pal.isNight ? 388 : 376;
      const orbY = 44;
      ctx.fillStyle = pal.isNight ? 'rgba(254, 240, 138, 0.08)' : 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(orbX - 24, orbY - 24, 48, 48);
      ctx.fillStyle = pal.isNight ? 'rgba(254, 240, 138, 0.16)' : 'rgba(254, 240, 138, 0.24)';
      ctx.fillRect(orbX - 15, orbY - 15, 30, 30);
      ctx.fillStyle = pal.isNight ? '#FEF08A' : '#FFFBEB';
      ctx.fillRect(orbX - 8, orbY - 8, 16, 16);
      if (pal.isNight) {
        ctx.fillStyle = pal.skyTop;
        ctx.fillRect(orbX - 3, orbY - 9, 10, 12); // crescent cutout
      }

      // Layered twinkling stars / nebula OR shaded 16-bit cumulus clouds
      if (pal.isNight) {
        for (let i = 0; i < 34; i++) {
          const sx = Math.floor(((i * 53 + 17) - camX * 0.1) % W + W) % W;
          const sy = (i * 29 + 9) % 138;
          const bright = (frame + i * 7) % 44 < 22;
          ctx.fillStyle = bright ? '#FEF08A' : '#94A3B8';
          ctx.fillRect(sx, sy, bright && i % 4 === 0 ? 2 : 1, bright && i % 4 === 0 ? 2 : 1);
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const cx = Math.floor(((i * 118 + 26) - camX * 0.14) % (W + 96) + (W + 96)) % (W + 96) - 48;
          const cy = 22 + (i % 3) * 24;
          // Shaded cloud belly
          ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.fillRect(cx + 2, cy + 7, 38, 5);
          // Main bright cloud puffs
          ctx.fillStyle = pal.cloudColor;
          ctx.fillRect(cx, cy, 40, 10);
          ctx.fillRect(cx + 6, cy - 6, 24, 7);
          ctx.fillRect(cx + 12, cy - 9, 12, 4);
          // Specular top crest
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(cx + 8, cy - 6, 18, 2);
        }
      }

      // --- 16-BIT 3-LAYER PARALLAX MOUNTAINS & SCULPTED HILLS ---
      // Far misty ridge
      ctx.fillStyle = pal.isNight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.18)';
      for (let i = -1; i < 5; i++) {
        const mx = Math.floor(i * 150 - ((camX * 0.15) % 150));
        ctx.fillRect(mx, 134, 124, 136);
        ctx.fillRect(mx + 20, 118, 84, 16);
        ctx.fillRect(mx + 42, 106, 40, 12);
      }
      // Mid-back hills with sunlit rim
      ctx.fillStyle = pal.hillBack;
      for (let i = -1; i < 6; i++) {
        const hx = Math.floor(i * 120 - ((camX * 0.28) % 120));
        ctx.fillRect(hx, 156, 98, 114);
        ctx.fillRect(hx + 14, 142, 70, 14);
        ctx.fillRect(hx + 28, 134, 42, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(hx + 28, 134, 42, 2);
        ctx.fillRect(hx + 14, 142, 70, 2);
        ctx.fillStyle = pal.hillBack;
      }
      // Foreground hills with depth shading
      ctx.fillStyle = pal.hillFront;
      for (let i = -1; i < 7; i++) {
        const hx = Math.floor(i * 96 - ((camX * 0.48) % 96));
        ctx.fillRect(hx, 184, 82, 86);
        ctx.fillRect(hx + 12, 172, 58, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(hx + 12, 172, 58, 2);
        ctx.fillStyle = 'rgba(11,14,23,0.16)';
        ctx.fillRect(hx + 66, 184, 16, 86);
        ctx.fillStyle = pal.hillFront;
      }

      // Ambient drifting 16-bit atmosphere motes (fireflies / sun pollen)
      for (let i = 0; i < 12; i++) {
        const mx = Math.floor(((i * 79 + elapsed * 14 * (i % 2 === 0 ? 1 : -0.7)) - camX * 0.65) % W + W) % W;
        const my = Math.floor(58 + ((i * 41) % 145) + Math.sin(elapsed * 2 + i) * 8);
        ctx.fillStyle = pal.isNight ? 'rgba(250, 204, 21, 0.55)' : 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(mx, my, 2, 2);
      }

      ctx.save();
      ctx.translate(-Math.round(camX) + shakeX, shakeY);

      // --- DRAW VISIBLE 16-BIT TEXTURED & BEVELED TILES ---
      const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
      const endCol = Math.min(cols - 1, Math.ceil((camX + W) / TILE) + 1);

      for (let r = 0; r < rows; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const ch = stage.grid[r][c];
          if (ch === '.' || ch === 'P' || ch === 'K' || ch === 'T' || ch === 'F') continue;
          const tx = c * TILE;
          const ty = r * TILE;

          if (ch === '#') {
            const topAir = r === 0 || stage.grid[r - 1][c] !== '#';
            const leftAir = c === 0 || stage.grid[r][c - 1] !== '#';
            const rightAir = c === cols - 1 || stage.grid[r][c + 1] !== '#';
            // Layered earth/masonry base
            ctx.fillStyle = pal.groundMid;
            ctx.fillRect(tx, ty, TILE, TILE);
            ctx.fillStyle = pal.groundDark;
            ctx.fillRect(tx, ty + 13, TILE, 3);
            ctx.fillRect(tx + ((c * 5 + r * 3) % 9) + 2, ty + 6, 4, 4);
            ctx.fillRect(tx + ((c * 7 + r * 5) % 8) + 5, ty + 11, 3, 2);
            // Soft pebble highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(tx + ((c * 5 + r * 3) % 9) + 2, ty + 6, 4, 1);
            // Beveled side edges
            if (leftAir) {
              ctx.fillStyle = 'rgba(255,255,255,0.16)';
              ctx.fillRect(tx, ty, 2, TILE);
            }
            if (rightAir) {
              ctx.fillStyle = 'rgba(11,14,23,0.28)';
              ctx.fillRect(tx + TILE - 2, ty, 2, TILE);
            }
            // Lush overhanging top turf / roof trim with drop shadow
            if (topAir) {
              ctx.fillStyle = 'rgba(11,14,23,0.32)';
              ctx.fillRect(tx, ty + 5, TILE, 2);
              ctx.fillStyle = pal.groundTop;
              ctx.fillRect(tx, ty, TILE, 5);
              ctx.fillStyle = 'rgba(255,255,255,0.32)';
              ctx.fillRect(tx, ty, TILE, 2);
              // Little grass/shingle notch texture
              ctx.fillStyle = pal.groundTop;
              ctx.fillRect(tx + 2, ty + 5, 4, 1);
              ctx.fillRect(tx + 10, ty + 5, 3, 1);
            }
          } else if (ch === '=') {
            // 16-bit 3D beveled brick / masonry block
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(tx, ty, TILE, TILE);
            ctx.fillStyle = pal.brickDark;
            ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = pal.brickMain;
            ctx.fillRect(tx + 1, ty + 1, TILE - 3, TILE - 3);
            // Top-left specular bevel
            ctx.fillStyle = pal.brickLight;
            ctx.fillRect(tx + 1, ty + 1, TILE - 2, 2);
            ctx.fillRect(tx + 1, ty + 1, 2, TILE - 3);
            // Brick mortar lines
            ctx.fillStyle = pal.brickDark;
            ctx.fillRect(tx + 1, ty + 8, TILE - 2, 1);
            ctx.fillRect(tx + 8, ty + 1, 1, 7);
            ctx.fillRect(tx + 4, ty + 9, 1, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(tx + 2, ty + 9, 2, 1);
            ctx.fillRect(tx + 6, ty + 9, 8, 1);
          } else if (ch === '-') {
            // 16-bit sculpted wooden / cloud one-way ledge
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(tx, ty, TILE, 7);
            ctx.fillStyle = pal.brickDark;
            ctx.fillRect(tx + 1, ty + 4, TILE - 2, 2);
            ctx.fillStyle = pal.accent;
            ctx.fillRect(tx + 1, ty + 1, TILE - 2, 4);
            ctx.fillStyle = '#FEF08A';
            ctx.fillRect(tx + 1, ty + 1, TILE - 2, 1);
            // Subtle end rivets
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(tx + 2, ty + 3, 1, 1);
            ctx.fillRect(tx + TILE - 3, ty + 3, 1, 1);
          } else if (ch === 'B') {
            // 16-bit tufted satin bouncy cushion!
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(tx, ty + 3, TILE, 13);
            ctx.fillStyle = '#831843';
            ctx.fillRect(tx + 1, ty + 4, TILE - 2, 11);
            ctx.fillStyle = '#EC4899';
            ctx.fillRect(tx + 1, ty + 4, TILE - 2, 8);
            ctx.fillStyle = '#F9A8D4';
            ctx.fillRect(tx + 2, ty + 4, TILE - 4, 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(tx + 3, ty + 5, 6, 1);
            // Tufted gold center button
            ctx.fillStyle = '#B45309';
            ctx.fillRect(tx + 6, ty + 8, 4, 4);
            ctx.fillStyle = '#FACC15';
            ctx.fillRect(tx + 6, ty + 8, 3, 3);
            ctx.fillStyle = '#FEF08A';
            ctx.fillRect(tx + 6, ty + 8, 2, 1);
          } else if (ch === 'D') {
            const st = crumbles.get(`${c},${r}`);
            if (st && st.state === 'gone') {
              // Subtle ghost preview when about to reform
              if (st.timer < 0.45) {
                ctx.fillStyle = 'rgba(248, 250, 252, 0.25)';
                ctx.fillRect(tx + 1, ty + 1, TILE - 2, TILE - 2);
              }
              continue;
            }
            const wiggle = st && st.state === 'shaking' ? Math.round(Math.sin(elapsed * 65) * 1.5) : 0;
            // 16-bit glossy 3D domino brick
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(tx + wiggle, ty, TILE, TILE);
            ctx.fillStyle = '#94A3B8';
            ctx.fillRect(tx + 1 + wiggle, ty + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(tx + 1 + wiggle, ty + 1, TILE - 3, TILE - 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(tx + 1 + wiggle, ty + 1, TILE - 3, 2);
            ctx.fillStyle = '#334155';
            ctx.fillRect(tx + 7 + wiggle, ty + 2, 2, TILE - 4);
            ctx.fillRect(tx + 3 + wiggle, ty + 4, 2, 2);
            ctx.fillRect(tx + 11 + wiggle, ty + 10, 2, 2);
          } else if (ch === '^') {
            // 16-bit crackling hearth ember hazard with warm bloom!
            const flick = Math.floor(frame / 4 + c) % 3;
            ctx.fillStyle = 'rgba(249, 115, 22, 0.24)';
            ctx.fillRect(tx - 2, ty + 2 - flick, 20, 14 + flick);
            ctx.fillStyle = '#991B1B';
            ctx.fillRect(tx + 1, ty + 9 - flick, 14, 7 + flick);
            ctx.fillStyle = '#EA580C';
            ctx.fillRect(tx + 2, ty + 7 - flick, 12, 8);
            ctx.fillStyle = '#FACC15';
            ctx.fillRect(tx + 4, ty + 9 - (flick % 2), 8, 5);
            ctx.fillStyle = '#FFFBEB';
            ctx.fillRect(tx + 6, ty + 11, 4, 3);
          }
        }
      }

      // --- 16-BIT ORNATE BRASS MOVING PLATFORMS ---
      for (const p of platforms) {
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        ctx.fillStyle = '#0B0E17';
        ctx.fillRect(px, py, p.w, p.h + 1);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(px + 1, py + 1, p.w - 2, p.h - 1);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(px + 1, py + 1, p.w - 2, p.h - 3);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(px + 2, py + 1, p.w - 4, 2);
        // Rivets & ruby center gem
        ctx.fillStyle = '#78350F';
        ctx.fillRect(px + 3, py + 3, 2, 2);
        ctx.fillRect(px + p.w - 5, py + 3, 2, 2);
        ctx.fillStyle = '#EF233C';
        ctx.fillRect(px + Math.floor(p.w / 2) - 2, py + 3, 4, 3);
      }

      // --- GOLDEN FISH TREATS ---
      for (const tr of treats) {
        if (!tr.collected) {
          drawTreat(ctx, tr.x, tr.y, elapsed);
        }
      }

      // --- HEALTH-RESTORING CANS OF CAT FOOD ---
      const playerNeedsHeal = player.hearts < startMaxHearts;
      for (const can of foodCans) {
        if (!can.collected) {
          drawCatFoodCan(ctx, can.x, can.y, elapsed, playerNeedsHeal);
        }
      }

      // --- ENEMIES ---
      for (const en of enemies) {
        if (en.alive) {
          drawEnemy(ctx, en.x, en.y, en.kind, frame, en.facing);
        }
      }

      // --- HIDDEN KITTEN GOAL! ---
      drawKitten(ctx, kittenX, kittenY, stage.kitten, {
        facing: player.x < kittenX ? -1 : 1,
        frame,
        happy: rescueAnimating,
        scale: 1.15,
        castShadow: true,
      });

      // 16-bit speech bubble with pointer tail
      if (rescueAnimating) {
        const bx = Math.round(kittenX - 26);
        const by = Math.round(kittenY - 42 - Math.abs(Math.sin(elapsed * 8) * 3));
        ctx.fillStyle = 'rgba(11, 14, 23, 0.45)';
        ctx.fillRect(bx + 2, by + 2, 54, 16);
        ctx.fillStyle = '#0B0E17';
        ctx.fillRect(bx - 1, by - 1, 54, 17);
        ctx.fillStyle = '#FFFBEB';
        ctx.fillRect(bx, by, 52, 15);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(bx, by + 11, 52, 4);
        ctx.fillStyle = '#FFFBEB';
        ctx.fillRect(bx + 24, by + 15, 4, 3);
        ctx.fillStyle = '#EF233C';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('MEOW! ♥', bx + 6, by + 10);
      } else if (Math.floor(elapsed * 1.4) % 3 === 0) {
        const bx = Math.round(kittenX - 19);
        const by = Math.round(kittenY - 36);
        ctx.fillStyle = 'rgba(20, 24, 38, 0.88)';
        ctx.fillRect(bx - 1, by - 1, 40, 14);
        ctx.fillStyle = '#364266';
        ctx.fillRect(bx, by, 38, 1);
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('meow?', bx + 6, by + 9);
      }

      // --- 16-BIT GLOWING FIREBALLS / STAR PUFFS ---
      for (const fb of fireballs) {
        const fx = Math.round(fb.x);
        const fy = Math.round(fb.y);
        ctx.fillStyle = fb.isStar ? 'rgba(250, 204, 21, 0.35)' : 'rgba(249, 115, 22, 0.35)';
        ctx.fillRect(fx - 6, fy - 6, 12, 12);
        if (fb.isStar) {
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(fx - 4, fy - 4, 8, 8);
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(fx - 3, fy - 3, 6, 6);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(fx - 1, fy - 1, 3, 3);
        } else {
          ctx.fillStyle = '#B91C1C';
          ctx.fillRect(fx - 4, fy - 4, 8, 8);
          ctx.fillStyle = '#F97316';
          ctx.fillRect(fx - 3, fy - 3, 6, 6);
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(fx - 2, fy - 2, 4, 4);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(fx - 1, fy - 1, 2, 2);
        }
      }

      // --- FIERIO! (with unmistakable 16-bit momentary invincibility shimmer + protective ring) ---
      const isInvincible = player.invulnTimer > 0;
      const shimmerPhase = Math.floor(elapsed * 16) % 2 === 0;
      let pose: 'idle' | 'run' | 'jump' | 'flutter' | 'dash' | 'bounce' | 'wall' = 'idle';
      if (player.dashTimer > 0) pose = 'dash';
      else if (player.tailBouncing) pose = 'bounce';
      else if (player.fluttering) pose = 'flutter';
      else if (!player.grounded && effWallKick && player.wallDir !== 0) pose = 'wall';
      else if (!player.grounded) pose = 'jump';
      else if (Math.abs(player.vx) > 12) pose = 'run';

      ctx.save();
      if (isInvincible) {
        // Protective shimmering invincibility halo so player clearly sees grace period
        const pulse = Math.round(Math.sin(elapsed * 24) * 2);
        const rx = Math.round(player.x);
        const ry = Math.round(player.y - 16);
        ctx.fillStyle = shimmerPhase ? 'rgba(254, 240, 138, 0.24)' : 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(rx - 18 - pulse, ry - 20 - pulse, 36 + pulse * 2, 40 + pulse * 2);
        ctx.strokeStyle = shimmerPhase ? 'rgba(255, 255, 255, 0.9)' : 'rgba(250, 204, 21, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx - 18 - pulse, ry - 20 - pulse, 36 + pulse * 2, 40 + pulse * 2);
        ctx.globalAlpha = shimmerPhase ? 0.48 : 0.92;
      }

      drawFierio(ctx, player.x, player.y, {
        facing: player.facing,
        pose,
        frame,
        hasFlameShield: effFlameShield,
        hasStarCrown: effStarCrown,
        scale: 1.45,
        castShadow: player.grounded,
      });
      ctx.restore();

      // --- PIXEL PARTICLES & RESCUE HEARTS ---
      for (const pt of particles) {
        ctx.fillStyle = pt.color;
        if (pt.isHeart) {
          const hx = Math.round(pt.x);
          const hy = Math.round(pt.y);
          ctx.fillRect(hx - 2, hy - 2, 2, 2);
          ctx.fillRect(hx + 1, hy - 2, 2, 2);
          ctx.fillRect(hx - 2, hy, 5, 2);
          ctx.fillRect(hx - 1, hy + 2, 3, 1);
          ctx.fillRect(hx, hy + 3, 1, 1);
          ctx.fillStyle = '#FFF1F2';
          ctx.fillRect(hx - 2, hy - 2, 1, 1);
        } else {
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
        }
      }

      // --- FLOATING HEAL / DAMAGE POPUPS ---
      for (const ft of floatingTexts) {
        const fx = Math.round(ft.x - 10);
        const fy = Math.round(ft.y);
        ctx.save();
        ctx.globalAlpha = Math.min(1, ft.life / (ft.maxLife * 0.45));
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#0B0E17';
        ctx.fillText(ft.text, fx + 1, fy + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, fx, fy);
        ctx.restore();
      }

      ctx.restore();
    };

    let rafId = 0;
    let lastTime = performance.now();
    let acc = 0;
    const FIXED_DT = 1 / 60;

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (overlayRef.current === 'none') {
        acc += rawDt;
        while (acc >= FIXED_DT) {
          stepPhysics(FIXED_DT);
          acc -= FIXED_DT;
        }
      }
      drawScene();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [stage, runId, totalTreats]);

  // Unlocked ability badges for HUD reference
  const activeAbilities = useMemo(
    () => STAGES.map((s) => s.rewardAbility).filter((a) => unlockedAbilities.has(a.id)),
    [unlockedAbilities]
  );

  // Touch control helper
  const bindTouch = (
    onDown: () => void,
    onUp?: () => void
  ) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      audio.unlock();
      onDown();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      if (onUp) onUp();
    },
    onPointerLeave: () => {
      if (onUp) onUp();
    },
    onPointerCancel: () => {
      if (onUp) onUp();
    },
  });

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3">
      {/* Unobtrusive Top Stage HUD */}
      <div className="bg-[#1E253B] border-2 border-[#364266] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="font-[var(--font-pixel)] text-xs sm:text-sm text-[#F8FAFC]">
            Stage {stage.id}: {stage.name}
          </div>

          <div className="flex items-center gap-1" aria-label={`Health ${hudHearts} of ${maxHearts}`}>
            {Array.from({ length: maxHearts }).map((_, idx) => (
              <Heart
                key={idx}
                className={`w-4 h-4 ${
                  idx < hudHearts ? 'text-[#EF233C] fill-[#EF233C]' : 'text-[#475569]'
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="ml-1 text-xs font-[var(--font-mono)] tabular-nums text-[#CBD5E1]">
              {hudHearts}/{maxHearts}
            </span>
          </div>

          <div className="text-xs font-[var(--font-mono)] tabular-nums text-[#FACC15]">
            Treats {hudTreats}/{totalTreats}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOverlay((o) => (o === 'paused' ? 'none' : o === 'none' ? 'paused' : o))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border border-[#4B5A87] text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            {overlay === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{overlay === 'paused' ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={restartStage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border border-[#4B5A87] text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>

          <button
            type="button"
            onClick={onExitToMap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A3454] hover:bg-[#364266] text-[#FEF08A] border border-[#4B5A87] text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>World Map</span>
          </button>
        </div>
      </div>

      {/* Main 16:9 8-Bit Stage Canvas + Clean State Overlays */}
      <div className="relative bg-[#0B0E17] border-2 border-[#364266] pixel-frame overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full aspect-video block pixel-canvas"
          aria-label={`Stage ${stage.id}: ${stage.name}. Guide Fierio to rescue ${stage.kitten.name}.`}
        />

        {/* PAUSED OVERLAY */}
        {overlay === 'paused' && (
          <div className="absolute inset-0 bg-[#0B0E17]/80 flex items-center justify-center p-4">
            <div className="bg-[#1E253B] border-2 border-[#4B5A87] p-6 max-w-sm w-full text-center space-y-4">
              <h3 className="font-[var(--font-pixel)] text-lg text-[#FEF08A]">Stage Paused</h3>
              <p className="text-xs text-[#CBD5E1]">{stage.tipText}</p>
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOverlay('none')}
                  onMouseEnter={() => setOverlayFocusIdx(0)}
                  className={`w-full py-2.5 bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] font-[var(--font-pixel)] text-xs cursor-pointer ${
                    gamepad.connected && overlayFocusIdx === 0 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  Resume Stage
                </button>
                <button
                  type="button"
                  onClick={restartStage}
                  onMouseEnter={() => setOverlayFocusIdx(1)}
                  className={`w-full py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border border-[#4B5A87] text-sm font-medium cursor-pointer ${
                    gamepad.connected && overlayFocusIdx === 1 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  Restart Stage
                </button>
                <button
                  type="button"
                  onClick={onExitToMap}
                  onMouseEnter={() => setOverlayFocusIdx(2)}
                  className={`w-full py-2.5 bg-[#141826] hover:bg-[#212942] text-[#CBD5E1] border border-[#364266] text-sm font-medium cursor-pointer ${
                    gamepad.connected && overlayFocusIdx === 2 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  Return to World Map
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {overlay === 'game_over' && (
          <div className="absolute inset-0 bg-[#0B0E17]/85 flex items-center justify-center p-4">
            <div className="bg-[#1E253B] border-2 border-[#EF233C] p-6 max-w-sm w-full text-center space-y-4">
              <h3 className="font-[var(--font-pixel)] text-lg text-[#FF758F]">Ouch! Try Again</h3>
              <p className="text-sm text-[#CBD5E1]">
                {stage.kitten.name} is still waiting in {stage.name}. Fierio is ready for another go!
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={restartStage}
                  onMouseEnter={() => setOverlayFocusIdx(0)}
                  className={`px-5 py-2.5 bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] font-[var(--font-pixel)] text-xs cursor-pointer whitespace-nowrap ${
                    gamepad.connected && overlayFocusIdx === 0 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  Retry Stage
                </button>
                <button
                  type="button"
                  onClick={onExitToMap}
                  onMouseEnter={() => setOverlayFocusIdx(1)}
                  className={`px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border border-[#4B5A87] text-sm font-medium cursor-pointer whitespace-nowrap ${
                    gamepad.connected && overlayFocusIdx === 1 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  World Map
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KITTEN RESCUED + NEW ABILITY UNLOCKED OVERLAY */}
        {overlay === 'rescued' && (
          <div className="absolute inset-0 bg-[#0B0E17]/85 flex items-center justify-center p-4">
            <div className="bg-[#1E253B] border-2 border-[#FACC15] p-6 max-w-md w-full text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC]">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>“Meow! ♥” — Kitten Rescued!</span>
              </div>

              <h3 className="font-[var(--font-pixel)] text-xl text-[#FEF08A]">
                You Found {stage.kitten.name}!
              </h3>

              <p className="text-sm text-[#CBD5E1]">{stage.kitten.bio}</p>

              <div className="bg-[#141826] border-2 border-[#364266] p-3.5 text-left space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-[var(--font-pixel)] text-[#FACC15]">
                    {wasAlreadyRescuedOnStart || unlockedAbilities.has(stage.rewardAbility.id)
                      ? 'Upgrade Mastered'
                      : 'New Ability Unlocked!'}
                  </span>
                  <span className="font-[var(--font-mono)] text-[#94A3B8]">
                    {getAbilityControlHint(stage.rewardAbility.id, gamepad.prompts, stage.rewardAbility.keyHint)}
                  </span>
                </div>
                <div className="text-base font-semibold text-[#F8FAFC]">
                  {stage.rewardAbility.name}
                </div>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  {stage.rewardAbility.shortDesc}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onExitToMap}
                  onMouseEnter={() => setOverlayFocusIdx(0)}
                  className={`px-5 py-2.5 bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] font-[var(--font-pixel)] text-xs cursor-pointer whitespace-nowrap ${
                    gamepad.connected && overlayFocusIdx === 0 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  {stage.id === 8
                    ? pitsySaves >= 2
                      ? 'Head Home & Rest!'
                      : 'Walk Home Together'
                    : `Unlock Stage ${stage.id + 1} on Map`}
                </button>
                <button
                  type="button"
                  onClick={restartStage}
                  onMouseEnter={() => setOverlayFocusIdx(1)}
                  className={`px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#CBD5E1] border border-[#4B5A87] text-xs font-medium cursor-pointer whitespace-nowrap ${
                    gamepad.connected && overlayFocusIdx === 1 ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]' : ''
                  }`}
                >
                  Replay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stage Tip & Unlocked Dragon Abilities Strip */}
      <div className="bg-[#1E253B] border-2 border-[#364266] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <p className="text-[#CBD5E1]">
          <strong className="text-[#FEF08A] font-semibold">Tip:</strong>{' '}
          {gamepad.connected && gamepad.prompts
            ? `${stage.tipText} (${gamepad.prompts.shortLabel}: ${gamepad.prompts.move}, ${gamepad.prompts.jump} Jump, ${gamepad.prompts.pause} Pause)`
            : stage.tipText}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#94A3B8] shrink-0">
          {activeAbilities.length === 0 ? (
            <span>
              {gamepad.connected && gamepad.prompts
                ? `Base Moves: ${gamepad.prompts.move} · ${gamepad.prompts.jump} Jump · Stomp`
                : 'Base Moves: Run · Jump · Stomp'}
            </span>
          ) : (
            activeAbilities.map((ab, idx) => (
              <span key={ab.id} className="whitespace-nowrap">
                {idx > 0 && <span className="mr-3 text-[#475569]" aria-hidden="true">·</span>}
                <strong className="text-[#F8FAFC] font-medium">{ab.name}</strong>{' '}
                <span className="text-[#94A3B8]">
                  ({getAbilityControlHint(ab.id, gamepad.prompts, ab.keyHint)})
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Mobile / Touch Controls (Automatically reveals unlocked ability buttons!) */}
      <div className="lg:hidden bg-[#1E253B] border-2 border-[#364266] p-3 flex items-center justify-between gap-3 select-none touch-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Move Left"
            {...bindTouch(
              () => { keysRef.current.left = true; },
              () => { keysRef.current.left = false; }
            )}
            className="w-12 h-12 bg-[#2A3454] active:bg-[#364266] border-2 border-[#4B5A87] flex items-center justify-center text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Move Right"
            {...bindTouch(
              () => { keysRef.current.right = true; },
              () => { keysRef.current.right = false; }
            )}
            className="w-12 h-12 bg-[#2A3454] active:bg-[#364266] border-2 border-[#4B5A87] flex items-center justify-center text-white"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          {hasTailBounce && (
            <button
              type="button"
              aria-label="Tail Bounce"
              {...bindTouch(
                () => {
                  keysRef.current.down = true;
                  keysRef.current.downPressed = true;
                },
                () => { keysRef.current.down = false; }
              )}
              className="w-12 h-12 bg-[#B45309] active:bg-[#D97706] border-2 border-[#FACC15] flex items-center justify-center text-white"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasFirePuff && (
            <button
              type="button"
              aria-label="Fire Puff"
              {...bindTouch(() => { keysRef.current.firePressed = true; })}
              className="w-12 h-12 bg-[#EA580C] active:bg-[#F97316] border-2 border-[#FDBA74] flex items-center justify-center text-white"
            >
              <Flame className="w-5 h-5" />
            </button>
          )}
          {hasEmberDash && (
            <button
              type="button"
              aria-label="Ember Dash"
              {...bindTouch(() => { keysRef.current.dashPressed = true; })}
              className="w-12 h-12 bg-[#7C3AED] active:bg-[#8B5CF6] border-2 border-[#C4B5FD] flex items-center justify-center text-white"
            >
              <Zap className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Jump"
            {...bindTouch(
              () => {
                keysRef.current.jumpHeld = true;
                keysRef.current.jumpPressed = true;
              },
              () => { keysRef.current.jumpHeld = false; }
            )}
            className="w-14 h-12 bg-[#EF233C] active:bg-[#DC1D34] border-2 border-[#FF758F] flex items-center justify-center text-white font-semibold"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
