import React, { useEffect, useRef, useState } from 'react';
import { STAGES } from '../game/stages';
import { drawFierio, drawKitten, drawMapleLeaf } from '../game/sprites';
import { audio } from '../game/audio';
import { gamepadManager, useGamepadMenu, useGamepadStatus } from '../game/gamepad';
import { FastForward } from 'lucide-react';

interface IntroCutsceneProps {
  onComplete: () => void;
}

const W = 480;
const H = 270;
const TOTAL_DURATION = 12.2;

export const IntroCutscene: React.FC<IntroCutsceneProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [caption, setCaption] = useState('Morning in Fierio’s cozy room... everyone is fast asleep.');
  const finishedRef = useRef(false);
  const mountTimeRef = useRef(performance.now());
  const gamepad = useGamepadStatus();

  const finishIntro = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    gamepadManager.suppressMenu(240);
    onComplete();
  };

  useGamepadMenu((ev) => {
    if (performance.now() - mountTimeRef.current < 320) return;
    if (ev.confirm || ev.pause || ev.cancel) {
      finishIntro();
    }
  });

  useEffect(() => {
    audio.startBgm('intro');

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finishIntro();
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

    // Pitsy is stage 8 (index 7); the other 7 kittens are indices 0..6
    const pitsy = STAGES[7].kitten;
    const otherKittens = STAGES.slice(0, 7).map((s) => s.kitten);

    // Resting coordinates for the 7 kittens before they chase Pitsy
    const restSpots = [
      { x: 196, y: 120 }, // Angelica on window sill!
      { x: 162, y: 212 }, // Wizzle by cushions
      { x: 204, y: 222 }, // D da Baller near board game
      { x: 248, y: 214 }, // Swipey on rug
      { x: 288, y: 224 }, // Ego near cards
      { x: 326, y: 210 }, // Mask near potted plant
      { x: 356, y: 222 }, // Loki by pillow
    ];

    const render = (now: number) => {
      const t = (now - startTime) / 1000;
      const frame = Math.floor(t * 60);

      // Trigger synced audio + story captions
      if (t >= 0.65) {
        cue('leaf', () => {
          audio.playLeafChime();
          setCaption('A bright autumn maple leaf floats past the open window!');
        });
      }
      if (t >= 1.5) {
        cue('pitsy_spot', () => {
          audio.playMeow(pitsy.meowPitch, true);
          setCaption('Pitsy spots the maple leaf and dashes out the door chasing it!');
        });
      }
      if (t >= 3.7) {
        cue('chase_start', () => {
          setCaption('Angelica, Wizzle, D da Baller, Swipey, Ego, Mask & Loki race after Pitsy!');
        });
      }
      otherKittens.forEach((k, idx) => {
        const triggerT = 3.85 + idx * 0.34;
        if (t >= triggerT) {
          cue(`k_meow_${idx}`, () => {
            if (idx % 2 === 0 || idx === 6) {
              audio.playMeow(k.meowPitch, false);
            } else {
              audio.playFootstep();
            }
          });
        }
      });
      if (t >= 8.0) {
        cue('fierio_wake', () => {
          setCaption('Fierio wakes up... Wait — where did all 8 kittens go?!');
        });
      }
      if (t >= 9.15) {
        cue('fierio_alarm', () => {
          audio.playAlarmExclaim();
          setCaption('Fierio leaps out of bed and sprints out the door to find them!');
        });
      }
      if (t >= 9.6) {
        cue('fierio_jump', () => {
          audio.playJump();
        });
      }
      if (t >= 10.35) {
        cue('fierio_step1', () => audio.playFootstep());
      }
      if (t >= 10.65) {
        cue('fierio_step2', () => audio.playFootstep());
      }
      if (t >= 10.95) {
        cue('fierio_step3', () => audio.playFootstep());
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;

          // --- 16-BIT SNES RPG BEDROOM INTERIOR ---
          const wallGrad = ctx.createLinearGradient(0, 0, 0, 178);
          wallGrad.addColorStop(0, '#1E2540');
          wallGrad.addColorStop(1, '#313C62');
          ctx.fillStyle = wallGrad;
          ctx.fillRect(0, 0, W, 178);
          // Shaded damask wallpaper stripes
          ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
          for (let wx = 0; wx < W; wx += 16) {
            ctx.fillRect(wx, 0, 6, 174);
          }

          // Crown molding & paneled wainscoting
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

          // Warm shaded oak plank flooring
          const floorGrad = ctx.createLinearGradient(0, 180, 0, H);
          floorGrad.addColorStop(0, '#92400E');
          floorGrad.addColorStop(1, '#6B2F0A');
          ctx.fillStyle = floorGrad;
          ctx.fillRect(0, 180, W, 90);
          ctx.fillStyle = '#451A03';
          for (let fy = 194; fy < H; fy += 16) {
            ctx.fillRect(0, fy, W, 2);
          }
          ctx.fillStyle = 'rgba(254, 240, 138, 0.1)';
          for (let fy = 182; fy < H; fy += 16) {
            ctx.fillRect(0, fy, W, 1);
          }

          // Cozy braided 16-bit rug with border stitching
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

          // Detailed mini board game on the rug
          ctx.fillStyle = '#78350F';
          ctx.fillRect(214, 210, 50, 26);
          ctx.fillStyle = '#FEF3C7';
          ctx.fillRect(216, 212, 46, 22);
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(220, 216, 38, 14);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(224, 219, 30, 8);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(228, 221, 6, 4);
          ctx.fillRect(242, 221, 6, 4);

          // Morning Window with layered 16-bit sky gradient & golden light shaft
          const winSky = ctx.createLinearGradient(0, 36, 0, 118);
          winSky.addColorStop(0, '#0284C7');
          winSky.addColorStop(0.65, '#38BDF8');
          winSky.addColorStop(1, '#FEF08A');
          ctx.fillStyle = winSky;
          ctx.fillRect(156, 36, 92, 82);
          // Distant morning clouds & meadow trees outside window
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(166, 52, 24, 7);
          ctx.fillRect(214, 46, 20, 6);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(156, 102, 92, 16);

          // Golden volumetric morning sunbeams across bedroom floor
          const beamGrad = ctx.createLinearGradient(200, 118, 200, 238);
          beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.24)');
          beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0.02)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(156, 118);
          ctx.lineTo(248, 118);
          ctx.lineTo(310, 238);
          ctx.lineTo(116, 238);
          ctx.closePath();
          ctx.fill();

          // Shaded window sill & mullions
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

          // Shaded pleated curtains with gold tiebacks
          ctx.fillStyle = '#991B1B';
          ctx.fillRect(146, 32, 20, 88);
          ctx.fillRect(238, 32, 20, 88);
          ctx.fillStyle = '#EF233C';
          ctx.fillRect(148, 32, 15, 86);
          ctx.fillRect(240, 32, 15, 86);
          ctx.fillStyle = '#FF758F';
          ctx.fillRect(150, 32, 3, 86);
          ctx.fillRect(242, 32, 3, 86);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(146, 86, 19, 4);
          ctx.fillRect(239, 86, 19, 4);

          // Ornate gold-framed wall painting
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
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(319, 52, 5, 5);

          // Shaded terracotta potted fern on right
          ctx.fillStyle = '#7C2D12';
          ctx.fillRect(343, 153, 26, 24);
          ctx.fillStyle = '#EA580C';
          ctx.fillRect(344, 154, 22, 22);
          ctx.fillStyle = '#FB923C';
          ctx.fillRect(340, 149, 32, 6);
          ctx.fillStyle = '#FDBA74';
          ctx.fillRect(341, 149, 24, 2);
          ctx.fillStyle = '#14532D';
          ctx.fillRect(345, 128, 9, 21);
          ctx.fillRect(357, 131, 9, 18);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(350, 118, 12, 31);
          ctx.fillStyle = '#86EFAC';
          ctx.fillRect(352, 120, 5, 10);

          // --- 16-BIT BEDROOM DOOR (Right Wall) ---
          const doorOpen = t >= 2.2;
          ctx.fillStyle = '#451A03';
          ctx.fillRect(408, 86, 56, 110);
          if (doorOpen) {
            const outSky = ctx.createLinearGradient(0, 91, 0, 191);
            outSky.addColorStop(0, '#38BDF8');
            outSky.addColorStop(0.68, '#BAE6FD');
            outSky.addColorStop(1, '#4ADE80');
            ctx.fillStyle = outSky;
            ctx.fillRect(414, 91, 44, 99);
            ctx.fillStyle = '#22C55E';
            ctx.fillRect(414, 160, 44, 30);
            ctx.fillStyle = '#15803D';
            ctx.fillRect(422, 144, 14, 18);
            ctx.fillStyle = '#78350F';
            ctx.fillRect(453, 88, 11, 106);
          } else {
            ctx.fillStyle = '#78350F';
            ctx.fillRect(414, 91, 44, 99);
            ctx.fillStyle = '#92400E';
            ctx.fillRect(420, 98, 32, 37);
            ctx.fillRect(420, 143, 32, 37);
            ctx.fillStyle = '#B45309';
            ctx.fillRect(420, 98, 32, 2);
            ctx.fillRect(420, 143, 32, 2);
            ctx.fillStyle = '#FACC15';
            ctx.fillRect(419, 139, 5, 5);
            ctx.fillStyle = '#FEF08A';
            ctx.fillRect(420, 140, 2, 2);
          }

          // --- 16-BIT CARVED WOOD BEDFRAME ---
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
          ctx.fillStyle = '#B45309';
          ctx.fillRect(24, 154, 10, 3);
          ctx.fillRect(24, 194, 99, 2);
          // Fluffy shaded pillow & mattress
          ctx.fillStyle = '#CBD5E1';
          ctx.fillRect(36, 172, 27, 12);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(37, 172, 24, 8);
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(36, 182, 78, 12);

          // --- FIERIO IN BED / WAKING UP / JUMPING OUT / RUNNING OUT ---
          if (t < 8.0) {
            // Sleeping peacefully in bed
            drawFierio(ctx, 68, 188, { pose: 'sleep', frame, facing: 1, scale: 1.65 });
            // Crimson blanket tucked over Fierio
            ctx.fillStyle = '#EF233C';
            ctx.fillRect(52, 176, 62, 18);
            ctx.fillStyle = '#B91C1C';
            ctx.fillRect(52, 188, 62, 6);
            // Floating Z z z
            const zOff = Math.floor(t * 14) % 18;
            ctx.fillStyle = '#E2E8F0';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('Z', 74, 146 - zOff);
            ctx.fillText('z', 86, 136 - ((zOff + 8) % 18));
          } else if (t < 9.55) {
            // Fierio wakes up in bed, looks around empty room!
            const surprised = t >= 9.05;
            const lookDir: 1 | -1 = t > 8.4 && t < 8.85 ? -1 : 1;
            // Tossed blanket
            ctx.fillStyle = '#EF233C';
            ctx.fillRect(76, 180, 38, 14);
            drawFierio(ctx, 66, 186, {
              pose: surprised ? 'surprise' : 'idle',
              frame,
              facing: lookDir,
              scale: 1.6,
            });
            // Thought / alarm bubble
            const bx = 66;
            const by = 130;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(bx - 10, by - 14, 20, 15);
            ctx.fillStyle = '#0F172A';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(surprised ? '!' : '?', bx - 4, by - 2);
          } else if (t < 10.25) {
            // Fierio JUMPS high out of bed!
            const p = (t - 9.55) / 0.7; // 0..1
            const fx = 66 + p * 84;
            const arc = Math.sin(p * Math.PI) * 56;
            const fy = 186 + p * 24 - arc;
            // Rumpled blanket on empty bed
            ctx.fillStyle = '#EF233C';
            ctx.fillRect(48, 182, 56, 12);
            drawFierio(ctx, fx, fy, { pose: 'jump', frame, facing: 1, scale: 1.6 });
          } else {
            // Rumpled empty bed
            ctx.fillStyle = '#EF233C';
            ctx.fillRect(48, 182, 56, 12);
            // Fierio SPRINTS across the bedroom and right out the open door!
            const p = Math.min(1, (t - 10.25) / 1.15);
            const fx = 150 + p * 310;
            if (fx < 458) {
              drawFierio(ctx, fx, 210, { pose: 'run', frame: frame * 2, facing: 1, scale: 1.6 });
              // Little speed dust puffs behind Fierio's feet
              ctx.fillStyle = '#E2E8F0';
              ctx.fillRect(Math.round(fx - 24), 204, 6, 4);
              ctx.fillRect(Math.round(fx - 34), 206, 4, 3);
            }
          }

          // --- FLOATING AUTUMN MAPLE LEAF ---
          if (t >= 0.5 && t < 3.6) {
            const p = (t - 0.5) / 3.1;
            const fx = 180 + p * 285;
            const fy = 78 + Math.sin(p * Math.PI * 3.5) * 16 + p * 88;
            if (fx < 455) {
              drawMapleLeaf(ctx, fx, fy, t * 2, 1.15);
            }
          } else if (t >= 7.8) {
            // One stray fluttering maple leaf left near the doorway for Fierio to spot
            drawMapleLeaf(ctx, 392, 198, t * 1.4, 1.05);
          }

          // --- PITSY CHASING THE MAPLE LEAF ---
          if (t < 1.45) {
            // Pitsy napping near the window rug
            drawKitten(ctx, 224, 194, pitsy, { sleeping: true, frame, scale: 1.15 });
          } else if (t < 1.95) {
            // Pitsy perks up with "!" and happy meow!
            drawKitten(ctx, 224, 194, pitsy, { happy: true, facing: 1, frame, scale: 1.15 });
            ctx.fillStyle = '#FEF08A';
            ctx.fillRect(216, 162, 16, 14);
            ctx.fillStyle = '#0F172A';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('!', 221, 173);
          } else if (t < 3.65) {
            const p = (t - 1.95) / 1.7;
            const px = 224 + p * 245;
            if (px < 454) {
              drawKitten(ctx, px, 198, pitsy, { happy: true, facing: 1, frame: frame * 1.5, scale: 1.15 });
            }
          }

          // --- THE OTHER 7 KITTENS CHASING AFTER PITSY ---
          otherKittens.forEach((kitten, idx) => {
            const spot = restSpots[idx];
            const wakeTime = 3.7 + idx * 0.34;
            const runTime = wakeTime + 0.38;

            if (t < wakeTime) {
              drawKitten(ctx, spot.x, spot.y, kitten, { sleeping: true, frame, scale: 1.1 });
            } else if (t < runTime) {
              drawKitten(ctx, spot.x, spot.y, kitten, { happy: false, facing: 1, frame, scale: 1.1 });
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(spot.x - 6, spot.y - 30, 12, 12);
              ctx.fillStyle = '#EF233C';
              ctx.font = 'bold 10px monospace';
              ctx.fillText('!', spot.x - 3, spot.y - 21);
            } else {
              const elapsed = t - runTime;
              const startY = idx === 0 ? Math.min(204, spot.y + elapsed * 140) : spot.y;
              const kx = spot.x + elapsed * 148;
              if (kx < 455) {
                drawKitten(ctx, kx, startY, kitten, {
                  happy: false,
                  facing: 1,
                  frame: frame * 1.6,
                  scale: 1.1,
                });
              }
            }
          });

          // --- CLASSIC 8-BIT IRIS-OUT INTO THE WORLD MAP ---
          if (t >= TOTAL_DURATION - 0.85) {
            const irisProgress = Math.min(1, (t - (TOTAL_DURATION - 0.85)) / 0.85);
            const radius = Math.max(0, (1 - irisProgress) * 320);
            ctx.save();
            ctx.fillStyle = '#141826';
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.arc(432, 146, radius, 0, Math.PI * 2, true);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      if (t >= TOTAL_DURATION) {
        finishIntro();
        return;
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
      <div className="relative bg-[#0B0E17] border-2 border-[#364266] pixel-frame overflow-hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full aspect-video block pixel-canvas"
          aria-label="Opening story cutscene showing Pitsy chasing a maple leaf, the other 7 kittens chasing Pitsy, and Fierio waking up to find them"
        />

        <button
          type="button"
          onClick={finishIntro}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E253B]/90 hover:bg-[#2A3454] text-[#F8FAFC] border-2 border-[#4B5A87] text-xs font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15]"
        >
          <span>Skip Intro</span>
          <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="bg-[#1E253B] border-2 border-[#364266] px-5 py-3.5 flex items-center justify-between gap-4">
        <p className="font-[var(--font-pixel)] text-xs sm:text-sm text-[#FEF08A] leading-relaxed">
          {caption}
        </p>
        <span className="text-xs text-[#94A3B8] whitespace-nowrap shrink-0 hidden sm:inline">
          {gamepad.connected && gamepad.prompts
            ? `Press ${gamepad.prompts.confirm} or ${gamepad.prompts.pause} to skip`
            : 'Press Space or Enter to skip'}
        </span>
      </div>
    </div>
  );
};
