import React, { useEffect, useRef, useState } from 'react';
import { STAGES } from '../game/stages';
import { drawFierio, drawKitten, drawMapleLeaf } from '../game/sprites';
import { audio } from '../game/audio';
import { gamepadManager, useGamepadMenu, useGamepadStatus } from '../game/gamepad';
import { FastForward, Film, Map, RotateCcw, Sparkles, Trophy } from 'lucide-react';

interface GrandReunionModalProps {
  endingMode: 'loop_1' | 'true_victory';
  totalTreats: number;
  maxTreats: number;
  onStartRoundTwo: () => void;
  onExploreMap: () => void;
  onPlayAgain: () => void;
}

const W = 480;
const H = 270;
const LOOP1_DURATION = 11.8;
const VICTORY_CUTSCENE_DURATION = 12.6;

export const GrandReunionModal: React.FC<GrandReunionModalProps> = ({
  endingMode,
  totalTreats,
  maxTreats,
  onStartRoundTwo,
  onExploreMap,
  onPlayAgain,
}) => {
  const cutsceneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const victoryBannerRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<'cutscene' | 'victory_screen'>('cutscene');
  const [replaySeed, setReplaySeed] = useState(0);
  const [caption, setCaption] = useState(
    endingMode === 'loop_1'
      ? 'At last! Fierio and all 8 kittens walk happily home together...'
      : 'They finally all made it home! Fierio and the kittens are totally exhausted...'
  );
  const [focusIdx, setFocusIdx] = useState(0);
  const finishedRef = useRef(false);
  const mountTimeRef = useRef(performance.now());
  const gamepad = useGamepadStatus();

  // Reset phase if endingMode changes
  useEffect(() => {
    setPhase('cutscene');
    finishedRef.current = false;
    mountTimeRef.current = performance.now();
    setCaption(
      endingMode === 'loop_1'
        ? 'At last! Fierio and all 8 kittens walk happily home together...'
        : 'They finally all made it home! Fierio and the kittens are totally exhausted...'
    );
  }, [endingMode, replaySeed]);

  const finishCutscene = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    gamepadManager.suppressMenu(240);
    if (endingMode === 'loop_1') {
      onStartRoundTwo();
    } else {
      setPhase('victory_screen');
      setFocusIdx(0);
    }
  };

  // Gamepad menu control for both Cutscene (skip) and Victory Screen (3 buttons)
  useGamepadMenu((ev) => {
    if (performance.now() - mountTimeRef.current < 340) return;

    if (phase === 'cutscene') {
      if (ev.confirm || ev.pause || ev.cancel) {
        finishCutscene();
      }
      return;
    }

    const delta = ev.dirX !== 0 ? ev.dirX : ev.dirY;
    if (delta !== 0) {
      audio.playFootstep();
      setFocusIdx((i) => (i + delta + 3) % 3);
    } else if (ev.cancel) {
      gamepadManager.suppressMenu(200);
      onExploreMap();
    } else if (ev.confirm || ev.pause) {
      gamepadManager.suppressMenu(200);
      if (focusIdx === 0) onExploreMap();
      else if (focusIdx === 1) setReplaySeed((s) => s + 1);
      else onPlayAgain();
    }
  });

  // =========================================================================
  // ENDING CUTSCENE ANIMATION (Both Loop 1 and True Victory Ending 2)
  // =========================================================================
  useEffect(() => {
    if (phase !== 'cutscene') return;

    audio.startBgm('intro');

    const handleKey = (e: KeyboardEvent) => {
      if (performance.now() - mountTimeRef.current < 340) return;
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finishCutscene();
      }
    };
    window.addEventListener('keydown', handleKey);

    let rafId = 0;
    const startTime = performance.now();
    const firedCues = new Set<string>();
    const cue = (id: string, fn: () => void) => {
      if (!firedCues.has(id)) {
        firedCues.add(id);
        fn();
      }
    };

    const pitsy = STAGES[7].kitten;
    const otherKittens = STAGES.slice(0, 7).map((s) => s.kitten);
    const allKittens = STAGES.map((s) => s.kitten);

    // Helper for crisp 16-bit speech bubbles
    const drawSpeechBubble = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      text: string,
      bg = '#FFFFFF',
      fg = '#0F172A',
      border = '#0B0E17'
    ) => {
      ctx.save();
      ctx.font = 'bold 9px monospace';
      const tw = Math.max(16, text.length * 6 + 8);
      const bx = Math.round(cx - tw / 2);
      const by = Math.round(cy - 14);
      ctx.fillStyle = border;
      ctx.fillRect(bx - 1, by - 1, tw + 2, 15);
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, tw, 13);
      // Tiny speech pointer
      ctx.fillStyle = border;
      ctx.fillRect(Math.round(cx - 2), by + 14, 5, 2);
      ctx.fillStyle = bg;
      ctx.fillRect(Math.round(cx - 1), by + 13, 3, 2);
      ctx.fillStyle = fg;
      ctx.fillText(text, bx + 4, by + 10);
      ctx.restore();
    };

    // Helper for cozy bedroom interior (shared with Ending 2)
    const drawBedroomInterior = (ctx: CanvasRenderingContext2D, doorOpen: boolean, nightAlpha: number, t: number) => {
      // Damask bedroom wall
      const wallGrad = ctx.createLinearGradient(0, 0, 0, 178);
      wallGrad.addColorStop(0, '#1E2540');
      wallGrad.addColorStop(1, '#313C62');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, W, 178);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      for (let wx = 0; wx < W; wx += 16) {
        ctx.fillRect(wx, 0, 6, 174);
      }

      // Wainscoting
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 146, W, 32);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(0, 146, W, 3);
      ctx.fillStyle = '#334155';
      for (let px = 8; px < W; px += 32) {
        ctx.fillRect(px, 152, 24, 18);
      }
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 176, W, 4);

      // Oak floor
      const floorGrad = ctx.createLinearGradient(0, 180, 0, H);
      floorGrad.addColorStop(0, '#92400E');
      floorGrad.addColorStop(1, '#6B2F0A');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 180, W, 90);
      ctx.fillStyle = '#451A03';
      for (let fy = 194; fy < H; fy += 16) {
        ctx.fillRect(0, fy, W, 2);
      }

      // Braided blue rug
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(145, 196, 216, 50);
      ctx.fillStyle = '#1E3A5F';
      ctx.fillRect(147, 198, 212, 46);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(152, 203, 202, 36);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(156, 206, 194, 30);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(154, 205, 198, 1);
      ctx.fillRect(154, 236, 198, 1);

      // Twilight Moonlit Window
      const winSky = ctx.createLinearGradient(0, 36, 0, 118);
      winSky.addColorStop(0, '#0F172A');
      winSky.addColorStop(0.65, '#1E1B4B');
      winSky.addColorStop(1, '#4C1D95');
      ctx.fillStyle = winSky;
      ctx.fillRect(156, 36, 92, 82);
      // Glowing crescent moon + stars outside window
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(218, 46, 14, 14);
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(223, 46, 10, 10);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(168, 48, 2, 2);
      ctx.fillRect(184, 62, 1, 1);
      ctx.fillRect(204, 50, 2, 2);
      ctx.fillRect(236, 68, 1, 1);
      ctx.fillStyle = '#14532D';
      ctx.fillRect(156, 102, 92, 16);

      // Soft moonlight shaft
      const beamGrad = ctx.createLinearGradient(200, 118, 200, 238);
      beamGrad.addColorStop(0, 'rgba(199, 210, 254, 0.22)');
      beamGrad.addColorStop(1, 'rgba(199, 210, 254, 0.02)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(156, 118);
      ctx.lineTo(248, 118);
      ctx.lineTo(310, 238);
      ctx.lineTo(116, 238);
      ctx.closePath();
      ctx.fill();

      // Window frame & crimson curtains
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(150, 31, 104, 6);
      ctx.fillRect(150, 118, 104, 8);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(151, 32, 102, 3);
      ctx.fillRect(151, 118, 102, 4);
      ctx.fillRect(152, 32, 5, 90);
      ctx.fillRect(247, 32, 5, 90);
      ctx.fillRect(200, 36, 4, 82);
      ctx.fillRect(156, 76, 92, 4);

      ctx.fillStyle = '#991B1B';
      ctx.fillRect(146, 32, 20, 88);
      ctx.fillRect(238, 32, 20, 88);
      ctx.fillStyle = '#EF233C';
      ctx.fillRect(148, 32, 15, 86);
      ctx.fillRect(240, 32, 15, 86);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(146, 86, 19, 4);
      ctx.fillRect(239, 86, 19, 4);

      // Wall painting
      ctx.fillStyle = '#78350F';
      ctx.fillRect(296, 40, 42, 46);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(298, 42, 38, 42);
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(303, 47, 28, 32);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(305, 49, 24, 15);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(305, 64, 24, 13);

      // Potted fern
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(343, 153, 26, 24);
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(344, 154, 22, 22);
      ctx.fillStyle = '#FB923C';
      ctx.fillRect(340, 149, 32, 6);
      ctx.fillStyle = '#14532D';
      ctx.fillRect(345, 128, 9, 21);
      ctx.fillRect(357, 131, 9, 18);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(350, 118, 12, 31);

      // Bedroom Door (Right Wall)
      ctx.fillStyle = '#451A03';
      ctx.fillRect(408, 86, 56, 110);
      if (doorOpen) {
        const outSky = ctx.createLinearGradient(0, 91, 0, 191);
        outSky.addColorStop(0, '#1E1B4B');
        outSky.addColorStop(0.68, '#4C1D95');
        outSky.addColorStop(1, '#14532D');
        ctx.fillStyle = outSky;
        ctx.fillRect(414, 91, 44, 99);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(453, 88, 11, 106);
      } else {
        ctx.fillStyle = '#78350F';
        ctx.fillRect(414, 91, 44, 99);
        ctx.fillStyle = '#92400E';
        ctx.fillRect(420, 98, 32, 37);
        ctx.fillRect(420, 143, 32, 37);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(419, 139, 5, 5);
      }

      // Carved wood bedframe
      ctx.fillStyle = 'rgba(11, 14, 23, 0.3)';
      ctx.fillRect(22, 208, 106, 6);
      ctx.fillStyle = '#451A03';
      ctx.fillRect(22, 152, 14, 60);
      ctx.fillRect(113, 172, 12, 40);
      ctx.fillRect(22, 192, 103, 16);
      ctx.fillStyle = '#92400E';
      ctx.fillRect(24, 154, 10, 56);
      ctx.fillRect(115, 174, 8, 36);
      ctx.fillRect(24, 194, 99, 10);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(36, 172, 27, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(37, 172, 24, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(36, 182, 78, 12);

      // Optional warm cozy night dim overlay
      if (nightAlpha > 0) {
        ctx.fillStyle = `rgba(11, 16, 36, ${nightAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }
      void t;
    };

    const renderLoop1 = (ctx: CanvasRenderingContext2D, t: number, frame: number) => {
      // Audio & caption cues for Ending 1
      if (t >= 0.4) {
        cue('walk_meow1', () => audio.playMeow(1.18, true));
      }
      if (t >= 1.6) {
        cue('walk_meow2', () => audio.playMeow(1.04, true));
      }
      if (t >= 3.55) {
        cue('door_leaf', () => {
          audio.playLeafChime();
          setCaption('Just as Fierio walks through the front door... another maple leaf blows past!');
        });
      }
      if (t >= 4.75) {
        cue('pitsy_bolt', () => {
          audio.playMeow(pitsy.meowPitch, true);
          setCaption('Pitsy spots the maple leaf and dashes off after it ALL OVER AGAIN!');
        });
      }
      if (t >= 6.25) {
        cue('kittens_panic', () => {
          audio.playLoudMeowChorus();
          gamepadManager.rumble('hurt');
          setCaption('MEOW!! MEOW!! All the kittens wave their arms and chase after Pitsy!');
        });
      }
      if (t >= 7.65) {
        cue('stampede_steps', () => {
          audio.playFootstep();
          window.setTimeout(() => audio.playFootstep(), 180);
          window.setTimeout(() => audio.playFootstep(), 360);
        });
      }
      if (t >= 9.25) {
        cue('fierio_peek', () => {
          audio.playAlarmExclaim();
          setCaption('Fierio peeks back outside... Not again!! (Starting Round 2 — All 8 Upgrades Kept!)');
        });
      }

      // --- GOLDEN AUTUMN SUNSET EXTERIOR OUTSIDE FIERIO'S HOUSE ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 184);
      skyGrad.addColorStop(0, '#1E1B4B');
      skyGrad.addColorStop(0.4, '#7C2D12');
      skyGrad.addColorStop(0.78, '#EA580C');
      skyGrad.addColorStop(1, '#FDE68A');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, 184);

      // Golden setting sun
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.fillRect(326, 52, 54, 54);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(334, 60, 38, 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(342, 66, 20, 14);

      // Soft warm clouds
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(205, 44, 48, 10);
      ctx.fillRect(216, 38, 26, 8);
      ctx.fillRect(398, 56, 54, 11);
      ctx.fillRect(410, 49, 28, 9);

      // Rolling sunset hills
      ctx.fillStyle = '#15803D';
      ctx.fillRect(0, 152, W, 42);
      ctx.fillStyle = '#166534';
      ctx.fillRect(170, 140, 130, 22);
      ctx.fillRect(330, 136, 150, 26);

      // Autumn maple tree on far right
      ctx.fillStyle = '#451A03';
      ctx.fillRect(428, 116, 14, 72);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(431, 116, 8, 70);
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(398, 78, 74, 46);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(404, 70, 62, 42);
      ctx.fillStyle = '#F97316';
      ctx.fillRect(412, 74, 42, 24);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(420, 78, 18, 10);

      // White wooden garden fence
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(156, 168, 270, 4);
      ctx.fillRect(156, 180, 270, 4);
      for (let fx = 162; fx < 424; fx += 18) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(fx, 160, 6, 30);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(fx + 4, 160, 2, 30);
      }

      // Lush front yard grass & warm cobblestone home path
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(0, 188, W, 82);
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(0, 242, W, 28);
      // Warm stepping stone path leading right to Fierio's front door
      ctx.fillStyle = '#92400E';
      ctx.fillRect(102, 202, 378, 34);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(104, 205, 376, 28);
      ctx.fillStyle = '#FDE68A';
      for (let sx = 114; sx < 474; sx += 26) {
        ctx.fillRect(sx, 209, 18, 9);
        ctx.fillRect(sx + 10, 221, 16, 8);
      }

      // --- FIERIO'S COZY HOME COTTAGE (Left Side) ---
      // Chimney & cozy smoke puffs
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(32, 38, 22, 46);
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(35, 38, 14, 44);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
      const puffY = (frame * 0.4) % 24;
      ctx.fillRect(38, Math.round(28 - puffY), 10, 8);
      ctx.fillRect(46, Math.round(16 - ((puffY + 10) % 24)), 12, 8);

      // House wall
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, 92, 158, 120);
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(0, 96, 152, 114);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(0, 168, 152, 42);
      // Timber framing
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, 96, 152, 6);
      ctx.fillRect(88, 96, 6, 114);
      ctx.fillRect(148, 96, 6, 114);

      // Pitched crimson shingled roof
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(0, 62, 168, 36);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(0, 66, 162, 28);
      ctx.fillStyle = '#EF4444';
      for (let ry = 70; ry < 92; ry += 8) {
        ctx.fillRect(0, ry, 158, 4);
      }
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(0, 94, 166, 3);

      // Glowing cozy cottage window
      ctx.fillStyle = '#451A03';
      ctx.fillRect(22, 122, 48, 42);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(26, 126, 40, 34);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(26, 146, 40, 14);
      ctx.fillStyle = '#451A03';
      ctx.fillRect(44, 126, 4, 34);
      ctx.fillRect(26, 141, 40, 4);

      // Open Warm Front Doorway (x = 104..144, y = 124..210)
      ctx.fillStyle = '#451A03';
      ctx.fillRect(100, 120, 48, 90);
      // Warm cozy hallway interior glow
      const doorGlow = ctx.createLinearGradient(104, 124, 144, 210);
      doorGlow.addColorStop(0, '#F59E0B');
      doorGlow.addColorStop(1, '#78350F');
      ctx.fillStyle = doorGlow;
      ctx.fillRect(104, 124, 40, 86);
      // Swung-open wooden door panel
      ctx.fillStyle = '#92400E';
      ctx.fillRect(144, 124, 10, 86);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(146, 168, 3, 4);
      // Welcome doormat
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(104, 210, 42, 8);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(108, 212, 34, 4);

      // --- FIERIO WALKING THROUGH THE FRONT DOOR & LATER PEEKING BACK OUT ---
      if (t < 3.45) {
        const p = t / 3.45;
        const fx = 340 - p * 204; // walks to x = 136
        drawFierio(ctx, fx, 218, {
          pose: 'run',
          frame,
          facing: -1,
          hasFlameShield: true,
          hasStarCrown: true,
          scale: 1.65,
          castShadow: true,
        });
      } else if (t < 4.3) {
        // Stepping inside the open doorway!
        const p = (t - 3.45) / 0.85;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p * 1.15);
        drawFierio(ctx, 136 - p * 18, 214 - p * 4, {
          pose: 'run',
          frame,
          facing: -1,
          hasFlameShield: true,
          hasStarCrown: true,
          scale: 1.65 - p * 0.2,
        });
        ctx.restore();
      } else if (t >= 9.2) {
        // Fierio pokes back out of the doorway shocked at the empty yard!
        const peekP = Math.min(1, (t - 9.2) / 0.45);
        const fx = 116 + peekP * 20;
        drawFierio(ctx, fx, 214, {
          pose: 'surprise',
          frame,
          facing: 1,
          hasFlameShield: true,
          hasStarCrown: true,
          scale: 1.65,
          castShadow: true,
        });
        drawSpeechBubble(ctx, fx + 4, 162, '!?', '#FEF08A', '#991B1B', '#0B0E17');
      }

      // --- WIND STREAKS + NEW MAPLE LEAF BLOWING PAST! ---
      if (t >= 3.55 && t < 6.6) {
        const p = (t - 3.55) / 2.9;
        // Soft autumn breeze lines
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        const wx = ((t * 190) % 520) - 40;
        ctx.fillRect(Math.round(wx), 124, 34, 2);
        ctx.fillRect(Math.round((wx + 160) % 500), 156, 26, 2);

        const lx = 136 + p * 375;
        const ly = 132 + Math.sin(p * Math.PI * 4) * 18 + p * 34;
        if (lx < 495) {
          drawMapleLeaf(ctx, lx, ly, t * 3.2, 1.25);
        }
      }

      // --- PITSY SPOTS THE LEAF & RUNS OFF AGAIN! ---
      const pitsyStopX = 342;
      if (t < 3.45) {
        const p = t / 3.45;
        const px = 492 - p * (492 - pitsyStopX);
        if (px < 490) {
          drawKitten(ctx, px, 224, { ...pitsy, holdsLeaf: false }, {
            facing: -1,
            frame: frame + 18,
            happy: true,
            scale: 1.15,
            castShadow: true,
          });
        }
      } else if (t < 4.75) {
        // Pitsy watches the maple leaf float right over him!
        drawKitten(ctx, pitsyStopX, 224, { ...pitsy, holdsLeaf: false }, {
          facing: 1,
          frame,
          happy: false,
          surprised: t >= 4.25,
          scale: 1.15,
          castShadow: true,
        });
        if (t >= 4.25) {
          drawSpeechBubble(ctx, pitsyStopX, 196, '!', '#FEF08A', '#991B1B');
        }
      } else if (t < 6.5) {
        // Off goes Pitsy chasing the maple leaf!
        const el = t - 4.75;
        const px = pitsyStopX + el * 155;
        if (px < 498) {
          drawKitten(ctx, px, 224, { ...pitsy, holdsLeaf: false }, {
            facing: 1,
            frame: frame * 2,
            happy: true,
            scale: 1.15,
            castShadow: true,
          });
          // Speed dust behind Pitsy
          ctx.fillStyle = '#FEF3C7';
          ctx.fillRect(Math.round(px - 18), 220, 6, 4);
          ctx.fillRect(Math.round(px - 26), 222, 4, 3);
        }
      }

      // --- THE OTHER 7 KITTENS: WALK HOME -> MEOW LOUDLY & WAVE ARMS -> RUN AFTER PITSY! ---
      const meowTexts = ['MEOW!!', 'NOO!!', 'MEOW!', 'WAIT!!', 'MROW!!', 'HEY!!', 'MEOW!!'];
      otherKittens.forEach((kitten, idx) => {
        const stopX = 176 + idx * 24;
        const stopY = 222 + (idx % 2) * 8;
        const startX = 368 + idx * 24;

        if (t < 3.45) {
          const p = t / 3.45;
          const kx = startX - p * (startX - stopX);
          if (kx < 495) {
            drawKitten(ctx, kx, stopY, kitten, {
              facing: -1,
              frame: frame + idx * 5,
              happy: true,
              scale: 1.1,
              castShadow: true,
            });
          }
        } else if (t < 6.2) {
          // Waiting outside the door, then turning to see Pitsy run off
          const lookRight = t >= 4.85;
          drawKitten(ctx, stopX, stopY, kitten, {
            facing: lookRight ? 1 : -1,
            frame: frame + idx * 4,
            happy: !lookRight,
            surprised: t >= 5.2,
            scale: 1.1,
            castShadow: true,
          });
        } else if (t < 7.55 + idx * 0.14) {
          // MEOW LOUDLY & WAVE ARMS FRANTICALLY!
          const jumpHop = -Math.abs(Math.round(Math.sin(t * 16 + idx * 1.1) * 5));
          drawKitten(ctx, stopX, stopY + jumpHop, kitten, {
            facing: 1,
            frame: frame * 2 + idx * 3,
            waving: true,
            scale: 1.12,
            castShadow: true,
          });
          // Pop alternating loud MEOW bubbles above waving kittens
          if (idx % 2 === 0 || t > 6.75) {
            drawSpeechBubble(
              ctx,
              stopX,
              stopY + jumpHop - 22 - (idx % 2) * 14,
              meowTexts[idx],
              '#FEF08A',
              '#DC2626'
            );
          }
        } else {
          // Bolt off to the right chasing after Pitsy!
          const runEl = t - (7.55 + idx * 0.14);
          const kx = stopX + runEl * 195;
          if (kx < 502) {
            drawKitten(ctx, kx, stopY, kitten, {
              facing: 1,
              frame: frame * 2.2 + idx * 3,
              waving: true,
              scale: 1.1,
              castShadow: true,
            });
            ctx.fillStyle = '#FEF3C7';
            ctx.fillRect(Math.round(kx - 16), stopY - 3, 5, 3);
          }
        }
      });

      // Classic 16-bit iris-out into Round 2 (keeping all 8 upgrades!)
      if (t >= LOOP1_DURATION - 0.85) {
        const irisP = Math.min(1, (t - (LOOP1_DURATION - 0.85)) / 0.85);
        const radius = Math.max(0, (1 - irisP) * 320);
        ctx.save();
        ctx.fillStyle = '#141826';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(136, 186, radius, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();
      }
    };

    const renderTrueVictoryCutscene = (ctx: CanvasRenderingContext2D, t: number, frame: number) => {
      // Audio & caption cues for Ending 2
      if (t >= 2.85) {
        cue('sleep_lullaby', () => {
          audio.playLullaby();
          setCaption('Fierio and all 8 kittens curl up and slowly drift off to sleep... Zzz...');
        });
      }
      if (t >= 6.2) {
        cue('night_leaf', () => {
          audio.playLeafChime();
          setCaption('As they drift off, a maple leaf floats past the window...');
        });
      }
      if (t >= 7.35) {
        cue('leaf_camera', () => {
          audio.playLeafChime();
          setCaption('...and flies straight toward the camera!');
        });
      }
      if (t >= 8.85) {
        cue('pitsy_awake', () => {
          audio.playMeow(pitsy.meowPitch, true);
        });
      }
      if (t >= 9.75) {
        cue('dogpile_nooo', () => {
          audio.playNooooChorus();
          gamepadManager.rumble('stomp');
          setCaption('ALL THE KITTENS JUMP ON PITSY: "NOOOOO!"');
        });
      }

      // Screen shake on the kitten dogpile landing!
      const shakeAmt = t >= 9.78 && t < 10.22 ? Math.round(Math.sin(t * 95) * 4) : 0;
      ctx.save();
      ctx.translate(shakeAmt, Math.round(shakeAmt * 0.5));

      const doorOpen = t < 2.35;
      const nightAlpha = t < 2.9 ? 0.08 : t < 4.5 ? 0.08 + ((t - 2.9) / 1.6) * 0.24 : 0.32;
      drawBedroomInterior(ctx, doorOpen, nightAlpha, t);

      // Resting spots around the cozy bedroom; Pitsy sleeps center-rug at (248, 222)
      const pitsySpot = { x: 248, y: 222 };
      const kittenSpots = [
        { x: 170, y: 214 }, // Angelica
        { x: 196, y: 234 }, // Wizzle
        { x: 222, y: 204 }, // D da Baller
        { x: 282, y: 206 }, // Swipey
        { x: 306, y: 232 }, // Ego
        { x: 336, y: 214 }, // Mask
        { x: 152, y: 234 }, // Loki
      ];

      // --- FIERIO EXHAUSTED -> SLEEPING IN BED -> SMILING AT THE DOGPILE ---
      if (t < 2.8) {
        const p = Math.min(1, t / 2.6);
        const fx = 420 - p * 340; // trudges slowly to bed
        drawFierio(ctx, fx, 208, {
          pose: 'run',
          frame: Math.floor(frame * 0.55), // tired slow walk
          facing: -1,
          hasFlameShield: true,
          hasStarCrown: true,
          scale: 1.6,
          castShadow: true,
        });
        // Tired sweat droplet
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(Math.round(fx + 10), 174 + (frame % 12), 2, 4);
      } else {
        // Fierio fast asleep in bed (or peeking fondly during the dogpile!)
        const awakeSmile = t >= 10.1;
        if (awakeSmile) {
          drawFierio(ctx, 68, 186, {
            pose: 'idle',
            frame,
            facing: 1,
            hasStarCrown: true,
            scale: 1.55,
          });
          ctx.fillStyle = '#EF233C';
          ctx.fillRect(54, 178, 60, 16);
          ctx.fillStyle = '#B91C1C';
          ctx.fillRect(54, 188, 60, 6);
          // Happy heart above Fierio
          ctx.fillStyle = '#FB7185';
          ctx.fillRect(88, 146, 3, 3);
          ctx.fillRect(92, 146, 3, 3);
          ctx.fillRect(88, 149, 7, 3);
          ctx.fillRect(90, 152, 3, 2);
        } else {
          drawFierio(ctx, 68, 188, { pose: 'sleep', frame, facing: 1, scale: 1.65 });
          ctx.fillStyle = '#EF233C';
          ctx.fillRect(52, 176, 62, 18);
          ctx.fillStyle = '#B91C1C';
          ctx.fillRect(52, 188, 62, 6);
          // Floating sleepy Z z z
          const zOff = Math.floor(t * 11) % 20;
          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('Z', 74, 148 - zOff);
          ctx.fillText('z', 86, 138 - ((zOff + 9) % 20));
        }
      }

      // --- PITSY & THE 7 KITTENS ---
      if (t < 2.8) {
        // Exhausted kittens trudging slowly home inside the room
        allKittens.forEach((kitten, idx) => {
          const target = idx === 7 ? pitsySpot : kittenSpots[idx];
          const p = Math.min(1, Math.max(0, (t - idx * 0.08) / 2.2));
          const kx = 446 - p * (446 - target.x);
          const ky = 204 + p * (target.y - 204);
          if (kx < 454) {
            drawKitten(ctx, kx, ky, { ...kitten, holdsLeaf: false }, {
              facing: -1,
              frame: Math.floor(frame * 0.5) + idx * 4,
              happy: false,
              scale: 1.08,
              castShadow: true,
            });
          }
        });
      } else if (t < 8.85) {
        // All 8 kittens fast asleep on the rug!
        kittenSpots.forEach((spot, idx) => {
          drawKitten(ctx, spot.x, spot.y, otherKittens[idx], {
            sleeping: true,
            frame,
            scale: 1.1,
          });
        });
        drawKitten(ctx, pitsySpot.x, pitsySpot.y, { ...pitsy, holdsLeaf: false }, {
          sleeping: true,
          frame,
          scale: 1.12,
        });
        // Peaceful floating Zzz over the sleeping kittens
        const kzOff = Math.floor(t * 10) % 16;
        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('z', 246, 200 - kzOff);
        ctx.fillText('z', 176, 196 - ((kzOff + 6) % 16));
        ctx.fillText('z', 316, 198 - ((kzOff + 11) % 16));
      } else if (t < 9.3) {
        // Pitsy perks wide awake spotting the leaf! Other 7 wake up in alarm!
        kittenSpots.forEach((spot, idx) => {
          drawKitten(ctx, spot.x, spot.y, otherKittens[idx], {
            facing: spot.x < pitsySpot.x ? 1 : -1,
            surprised: t >= 9.05,
            sleeping: t < 9.05,
            frame,
            scale: 1.1,
          });
        });
        drawKitten(ctx, pitsySpot.x, pitsySpot.y, { ...pitsy, holdsLeaf: false }, {
          facing: 1,
          surprised: true,
          frame,
          scale: 1.15,
          castShadow: true,
        });
        drawSpeechBubble(ctx, pitsySpot.x, pitsySpot.y - 24, '!', '#FEF08A', '#DC2626');
      } else if (t < 9.8) {
        // ALL 7 KITTENS LEAP THROUGH THE AIR TOWARD PITSY!
        const jumpP = (t - 9.3) / 0.5; // 0..1
        drawKitten(ctx, pitsySpot.x, pitsySpot.y, { ...pitsy, holdsLeaf: false }, {
          facing: 1,
          surprised: true,
          frame,
          scale: 1.15,
          castShadow: true,
        });
        kittenSpots.forEach((spot, idx) => {
          const destX = pitsySpot.x + ((idx % 3) - 1) * 14;
          const destY = pitsySpot.y - Math.floor(idx / 3) * 8;
          const kx = spot.x + (destX - spot.x) * jumpP;
          const arc = Math.sin(jumpP * Math.PI) * (54 + (idx % 3) * 12);
          const ky = spot.y + (destY - spot.y) * jumpP - arc;
          drawKitten(ctx, kx, ky, otherKittens[idx], {
            facing: spot.x < pitsySpot.x ? 1 : -1,
            waving: true,
            frame: frame * 2 + idx * 4,
            scale: 1.12,
          });
        });
      } else {
        // --- HILARIOUS DOGPILE ON TOP OF PITSY + GIANT "NOOOOO!" ---
        // Soft dust impact ring
        const dustP = Math.min(1, (t - 9.8) / 0.6);
        if (dustP < 1) {
          ctx.fillStyle = `rgba(248, 250, 252, ${0.7 * (1 - dustP)})`;
          ctx.fillRect(Math.round(pitsySpot.x - 42 - dustP * 24), 212, 18, 10);
          ctx.fillRect(Math.round(pitsySpot.x + 26 + dustP * 24), 212, 18, 10);
        }

        // Pitsy pinned underneath the center of the pile!
        drawKitten(ctx, pitsySpot.x, pitsySpot.y + 4, { ...pitsy, holdsLeaf: false }, {
          facing: 1,
          surprised: true,
          frame,
          scale: 1.12,
        });

        // Stacked pyramid of all 7 kittens holding Pitsy down!
        const pileOffsets: [number, number, 1 | -1][] = [
          [-20, 0, 1],
          [20, 0, -1],
          [-10, -11, 1],
          [11, -11, -1],
          [-14, -22, 1],
          [14, -22, -1],
          [0, -31, 1],
        ];
        otherKittens.forEach((kitten, idx) => {
          const [ox, oy, dir] = pileOffsets[idx];
          const wiggle = Math.round(Math.sin(t * 22 + idx * 1.4) * 1.2);
          drawKitten(ctx, pitsySpot.x + ox + wiggle, pitsySpot.y + oy, kitten, {
            facing: dir,
            waving: t < 11.4,
            happy: t >= 11.4,
            frame: frame * 2 + idx * 5,
            scale: 1.1,
            castShadow: idx < 2,
          });
        });

        // Dramatic comic starburst + GIANT "NOOOOO!" shout!
        const shoutScale = Math.min(1, (t - 9.8) / 0.18);
        const jitterX = t < 11.2 ? Math.round(Math.sin(t * 75) * 2) : 0;
        const jitterY = t < 11.2 ? Math.round(Math.cos(t * 65) * 1.5) : 0;
        ctx.save();
        ctx.translate(252 + jitterX, 118 + jitterY);
        ctx.scale(shoutScale, shoutScale);

        // Starburst comic speech banner
        ctx.fillStyle = '#0B0E17';
        ctx.fillRect(-86, -24, 172, 46);
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(-82, -20, 164, 38);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-78, -16, 156, 30);
        // Pointer down to kitten dogpile
        ctx.fillStyle = '#0B0E17';
        ctx.fillRect(-6, 22, 12, 10);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(-4, 20, 8, 9);

        // Bold 16-bit shadowed "NOOOOO!"
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0B0E17';
        ctx.fillText('NOOOOO!', 2, 11);
        ctx.fillStyle = '#DC2626';
        ctx.fillText('NOOOOO!', 0, 9);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('NOOOOO!', -1, 8);
        ctx.restore();

        // Smaller echo speech bubbles on either side
        if (t >= 10.15) {
          drawSpeechBubble(ctx, 168, 164, 'Nooooo!', '#FFFFFF', '#DC2626');
          drawSpeechBubble(ctx, 336, 162, 'Nooooo!', '#FFFFFF', '#DC2626');
        }
      }

      // --- MAPLE LEAF FLOATING BY WINDOW -> FLYING STRAIGHT TOWARD THE CAMERA! ---
      if (t >= 6.2 && t < 7.4) {
        const p = (t - 6.2) / 1.2;
        const lx = 160 + p * 54;
        const ly = 64 + Math.sin(p * Math.PI * 2.5) * 8 + p * 18;
        drawMapleLeaf(ctx, lx, ly, t * 2.5, 1.05);
      } else if (t >= 7.4 && t < 9.05) {
        const p = (t - 7.4) / 1.65;
        const leafScale = 1.05 + Math.pow(p, 2.2) * 15.5;
        const lx = 214 + p * 54 + Math.sin(p * Math.PI * 2.2) * 26;
        const ly = 82 + p * 86;
        const rot = p * 5.4;

        // Dynamic speed lines as the maple leaf zooms toward the viewer!
        if (p > 0.25 && p < 0.92) {
          ctx.fillStyle = `rgba(254, 240, 138, ${0.32 * (1 - p)})`;
          ctx.fillRect(Math.round(lx - 44 * p), Math.round(ly - 24 * p), 26, 2);
          ctx.fillRect(Math.round(lx + 24 * p), Math.round(ly + 18 * p), 24, 2);
        }
        drawMapleLeaf(ctx, lx, ly, t * 3, leafScale, rot);
      }

      ctx.restore();

      // Smooth fade to the Victory Screen at the very end
      if (t >= VICTORY_CUTSCENE_DURATION - 0.65) {
        const fade = Math.min(1, (t - (VICTORY_CUTSCENE_DURATION - 0.65)) / 0.65);
        ctx.fillStyle = `rgba(20, 24, 38, ${fade})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    const render = (now: number) => {
      const t = (now - startTime) / 1000;
      const frame = Math.floor(t * 60);
      const canvas = cutsceneCanvasRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          if (endingMode === 'loop_1') {
            renderLoop1(ctx, t, frame);
          } else {
            renderTrueVictoryCutscene(ctx, t, frame);
          }
        }
      }

      const maxDuration = endingMode === 'loop_1' ? LOOP1_DURATION : VICTORY_CUTSCENE_DURATION;
      if (t >= maxDuration) {
        finishCutscene();
        return;
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKey);
    };
  }, [phase, endingMode, replaySeed]);

  // =========================================================================
  // TRUE VICTORY SCREEN BANNER ANIMATION (Only after Ending 2 finishes)
  // =========================================================================
  useEffect(() => {
    if (phase !== 'victory_screen') return;

    audio.startBgm('map');
    audio.playVictoryFanfare();

    let raf = 0;
    const start = performance.now();
    const pitsy = STAGES[7].kitten;
    const otherKittens = STAGES.slice(0, 7).map((s) => s.kitten);

    const renderBanner = (now: number) => {
      const time = (now - start) / 1000;
      const frame = Math.floor(time * 60);
      const canvas = victoryBannerRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          // Starry victory twilight room backdrop
          const grad = ctx.createLinearGradient(0, 0, 0, 96);
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(0.55, '#312E81');
          grad.addColorStop(1, '#4C1D95');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 440, 96);

          // Twinkling victory stars
          for (let i = 0; i < 28; i++) {
            const sx = (i * 37 + 12) % 428;
            const sy = (i * 19 + 8) % 66;
            ctx.fillStyle = (frame + i * 5) % 24 < 12 ? '#FEF08A' : '#A5B4FC';
            ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
          }

          // Cozy moonlit floor
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(0, 95, 440, 2);
          ctx.fillStyle = '#92400E';
          ctx.fillRect(0, 97, 440, 17);
          ctx.fillStyle = '#78350F';
          for (let bx = 0; bx < 440; bx += 28) {
            ctx.fillRect(bx, 97, 2, 17);
          }

          // Star-Fierio wearing Golden Crown proudly on left-center!
          drawFierio(ctx, 134, 96, {
            pose: 'idle',
            frame,
            facing: 1,
            hasFlameShield: true,
            hasStarCrown: true,
            scale: 2.05,
            castShadow: true,
          });

          // Cozy victorious nap-pile: all 7 kittens happily snoozing on top of Pitsy!
          const pileX = 286;
          drawKitten(ctx, pileX, 98, { ...pitsy, holdsLeaf: false }, {
            facing: -1,
            sleeping: true,
            frame,
            scale: 1.15,
          });
          const napOffsets: [number, number, 1 | -1][] = [
            [-24, 0, 1],
            [24, 0, -1],
            [-12, -10, 1],
            [12, -10, -1],
            [-14, -20, 1],
            [14, -20, -1],
            [0, -29, -1],
          ];
          otherKittens.forEach((kitten, idx) => {
            const [ox, oy, dir] = napOffsets[idx];
            drawKitten(ctx, pileX + ox, 96 + oy, kitten, {
              facing: dir,
              happy: true,
              frame: frame + idx * 6,
              scale: 1.05,
              castShadow: idx < 2,
            });
          });

          // Floating sleepy Zzz & happy hearts
          const zOff = Math.floor(time * 10) % 14;
          ctx.fillStyle = '#FEF08A';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('Zzz...', pileX - 16, 44 - zOff);

          // Tiny harmless maple leaf framed on the far right!
          drawMapleLeaf(ctx, 396, 42, time * 1.8, 1.15);
        }
      }
      raf = requestAnimationFrame(renderBanner);
    };
    raf = requestAnimationFrame(renderBanner);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // =========================================================================
  // RENDER: CUTSCENE MODE (Loop 1 or Ending 2 Cutscene)
  // =========================================================================
  if (phase === 'cutscene') {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
        <div className="relative bg-[#0B0E17] border-2 border-[#FACC15] pixel-frame overflow-hidden">
          <canvas
            ref={cutsceneCanvasRef}
            width={W}
            height={H}
            className="w-full aspect-video block pixel-canvas"
            aria-label={
              endingMode === 'loop_1'
                ? 'Ending cutscene where Fierio walks home, another maple leaf blows past, Pitsy chases it again, and the other 7 kittens meow loudly and run after him'
                : 'True ending cutscene where Fierio and all 8 kittens make it home exhausted, drift off to sleep, a maple leaf flies toward the camera, and all the kittens jump on Pitsy yelling Nooooo'
            }
          />

          <button
            type="button"
            onClick={finishCutscene}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E253B]/90 hover:bg-[#2A3454] text-[#F8FAFC] border-2 border-[#4B5A87] text-xs font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15]"
          >
            <span>{endingMode === 'loop_1' ? 'Skip to Round 2' : 'Skip to Victory'}</span>
            <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="bg-[#1E253B] border-2 border-[#364266] px-5 py-3.5 flex items-center justify-between gap-4">
          <p className="font-[var(--font-pixel)] text-xs sm:text-sm text-[#FEF08A] leading-relaxed">
            {caption}
          </p>
          <span className="text-xs text-[#94A3B8] whitespace-nowrap shrink-0 hidden sm:inline">
            {gamepad.connected && gamepad.prompts
              ? `Press ${gamepad.prompts.confirm} to skip`
              : 'Press Space or Enter to skip'}
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: TRUE VICTORY SCREEN (After Saving Pitsy Twice!)
  // =========================================================================
  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1E253B] border-2 border-[#FACC15] pixel-frame p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FACC15] mb-1">
            <Trophy className="w-4 h-4" aria-hidden="true" />
            <span>True Ending · Everyone Made It Home Safe!</span>
          </div>
          <h2 className="font-[var(--font-pixel)] text-2xl sm:text-3xl text-[#FEF08A]">
            VICTORY!
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="font-[var(--font-mono)] tabular-nums text-xs sm:text-sm text-[#86EFAC] bg-[#141826] border-2 border-[#364266] px-3.5 py-2">
            Upgrades: 8 / 8
          </div>
          <div className="font-[var(--font-mono)] tabular-nums text-xs sm:text-sm text-[#FEF08A] bg-[#141826] border-2 border-[#364266] px-3.5 py-2">
            Treats: {totalTreats} / {maxTreats}
          </div>
        </div>
      </div>

      {/* Animated 16-bit Victory Nap Pile Banner */}
      <div className="border-2 border-[#364266] bg-[#141826] overflow-hidden">
        <canvas
          ref={victoryBannerRef}
          width={440}
          height={114}
          className="w-full h-28 sm:h-36 block pixel-canvas"
          aria-label="Victory scene showing Star-Fierio smiling while the 7 kittens nap in a happy pile keeping Pitsy safely at home"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-5 border-2 border-[#364266] bg-[#141826] overflow-hidden">
          <img
            src="/assets/aistudio/fierio-kids-47-board-game-night_bc689877.jpg"
            alt="Fierio and the kittens back together for board game night"
            referrerPolicy="no-referrer"
            className="w-full h-48 object-cover"
          />
        </div>
        <div className="md:col-span-7 space-y-3">
          <p className="text-sm sm:text-base text-[#CBD5E1] leading-relaxed">
            After two grand maple-leaf chases, <strong className="text-white">Angelica, Wizzle, D da Baller, Swipey, Ego, Mask, and Loki</strong> finally pinned Pitsy down before he could bolt again—and everyone got to curl up, get some sleep, and enjoy board game night with Fierio!
          </p>
          <p className="text-sm text-[#94A3B8] inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#FACC15] shrink-0" aria-hidden="true" />
            <span>
              All 8 stages and every <span className="text-[#FEF08A] font-medium">Star-Fierio</span> dragon upgrade are unlocked for free replay!
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onExploreMap}
              onMouseEnter={() => setFocusIdx(0)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] font-[var(--font-pixel)] text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                gamepad.connected && focusIdx === 0
                  ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                  : ''
              }`}
            >
              <Map className="w-4 h-4" aria-hidden="true" />
              <span>Explore Map</span>
            </button>
            <button
              type="button"
              onClick={() => setReplaySeed((s) => s + 1)}
              onMouseEnter={() => setFocusIdx(1)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#FEF08A] border-2 border-[#FACC15]/70 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                gamepad.connected && focusIdx === 1
                  ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                  : ''
              }`}
            >
              <Film className="w-4 h-4" aria-hidden="true" />
              <span>Replay Ending</span>
            </button>
            <button
              type="button"
              onClick={onPlayAgain}
              onMouseEnter={() => setFocusIdx(2)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border-2 border-[#4B5A87] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                gamepad.connected && focusIdx === 2
                  ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                  : ''
              }`}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>New Adventure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
