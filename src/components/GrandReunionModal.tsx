import React, { useEffect, useRef, useState } from 'react';
import { STAGES } from '../game/stages';
import { drawFeather, drawFierio, drawKitten } from '../game/sprites';
import { audio } from '../game/audio';
import { gamepadManager, useGamepadMenu, useGamepadStatus } from '../game/gamepad';
import { Map, RotateCcw, Sparkles } from 'lucide-react';

interface GrandReunionModalProps {
  totalTreats: number;
  maxTreats: number;
  onExploreMap: () => void;
  onPlayAgain: () => void;
}

export const GrandReunionModal: React.FC<GrandReunionModalProps> = ({
  totalTreats,
  maxTreats,
  onExploreMap,
  onPlayAgain,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const gamepad = useGamepadStatus();

  useGamepadMenu((ev) => {
    if (ev.dirX !== 0 || ev.dirY !== 0) {
      audio.playFootstep();
      setFocusIdx((i) => (i === 0 ? 1 : 0));
    } else if (ev.cancel) {
      gamepadManager.suppressMenu(200);
      onExploreMap();
    } else if (ev.confirm || ev.pause) {
      gamepadManager.suppressMenu(200);
      if (focusIdx === 0) onExploreMap();
      else onPlayAgain();
    }
  });

  useEffect(() => {
    audio.startBgm('map');
    // Happy chorus of kitten meows!
    audio.playMeow(1.24, true);
    const t1 = window.setTimeout(() => audio.playMeow(1.12, true), 260);
    const t2 = window.setTimeout(() => audio.playMeow(0.98, true), 520);

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const time = (now - start) / 1000;
      const frame = Math.floor(time * 60);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const grad = ctx.createLinearGradient(0, 0, 0, 92);
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(0.6, '#312E81');
          grad.addColorStop(1, '#4C1D95');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 420, 92);
          // Twinkling victory stars
          for (let i = 0; i < 24; i++) {
            const sx = (i * 37 + 12) % 410;
            const sy = (i * 19 + 8) % 62;
            ctx.fillStyle = (frame + i * 5) % 24 < 12 ? '#FEF08A' : '#A5B4FC';
            ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
          }
          // 16-bit beveled castle floor
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 91, 420, 2);
          ctx.fillStyle = '#CBD5E1';
          ctx.fillRect(0, 93, 420, 3);
          ctx.fillStyle = '#475569';
          ctx.fillRect(0, 96, 420, 14);
          ctx.fillStyle = '#334155';
          for (let bx = 0; bx < 420; bx += 24) {
            ctx.fillRect(bx, 96, 2, 14);
          }

          // Star-Fierio with Golden Crown in the center!
          drawFierio(ctx, 210, 92, {
            pose: 'idle',
            frame,
            facing: 1,
            hasFlameShield: true,
            hasStarCrown: true,
            scale: 2.15,
            castShadow: true,
          });

          // 4 kittens on the left, 4 kittens on the right — all hopping & meowing happily!
          STAGES.slice(0, 4).forEach((st, idx) => {
            drawKitten(ctx, 28 + idx * 36, 92, st.kitten, {
              facing: 1,
              frame: frame + idx * 6,
              happy: true,
              scale: 1.15,
              castShadow: true,
            });
          });
          STAGES.slice(4, 8).forEach((st, idx) => {
            drawKitten(ctx, 284 + idx * 36, 92, st.kitten, {
              facing: -1,
              frame: frame + idx * 6,
              happy: true,
              scale: 1.15,
              castShadow: true,
            });
          });

          // Floating golden feather above Pitsy
          drawFeather(ctx, 386, 44, time * 2.5);
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1E253B] border-2 border-[#FACC15] pixel-frame p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FACC15] mb-1">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Star-Fierio Crown Unlocked</span>
          </div>
          <h2 className="font-[var(--font-pixel)] text-2xl sm:text-3xl text-[#F8FAFC]">
            All 8 Kittens Reunited!
          </h2>
        </div>
        <div className="font-[var(--font-mono)] tabular-nums text-sm text-[#FEF08A] bg-[#141826] border-2 border-[#364266] px-4 py-2 self-start sm:self-auto">
          Treats: {totalTreats} / {maxTreats}
        </div>
      </div>

      {/* Animated 8-bit Reunion Parade */}
      <div className="border-2 border-[#364266] bg-[#141826] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={420}
          height={110}
          className="w-full h-28 sm:h-36 block pixel-canvas"
          aria-label="Star-Fierio wearing his golden crown surrounded by all 8 rescued kittens hopping happily"
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
            Pitsy finally caught the golden feather, and Fierio brought <strong className="text-white">Angelica, Wizzle, D da Baller, Swipey, Ego, Mask, Loki, and Pitsy</strong> safely back home for board game night!
          </p>
          <p className="text-sm text-[#94A3B8]">
            You have unlocked all 8 dragon abilities, including the <span className="text-[#FEF08A] font-medium">Star-Fierio Crown</span> for golden replays across every stage on the world map.
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
              onClick={onPlayAgain}
              onMouseEnter={() => setFocusIdx(1)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border-2 border-[#4B5A87] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                gamepad.connected && focusIdx === 1
                  ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                  : ''
              }`}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Play Again</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
