import React, { useEffect, useRef, useState } from 'react';
import { PlayerProgress } from '../game/types';
import { drawFeather, drawFierio, drawKitten } from '../game/sprites';
import { STAGES } from '../game/stages';
import { audio } from '../game/audio';
import { gamepadManager, useGamepadMenu, useGamepadStatus } from '../game/gamepad';
import { Film, Play, RotateCcw } from 'lucide-react';

interface TitleScreenProps {
  progress: PlayerProgress;
  onStartAdventure: () => void;
  onWatchIntro: () => void;
  onResetProgress: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  progress,
  onStartAdventure,
  onWatchIntro,
  onResetProgress,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bookImgFailed, setBookImgFailed] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [confirmIdx, setConfirmIdx] = useState(1); // Default to Cancel for safety

  const hasProgress = progress.rescuedStages.length > 0 || progress.introSeen;
  const gamepad = useGamepadStatus();
  const mainCount = hasProgress ? 3 : 2;

  useEffect(() => {
    if (focusIdx >= mainCount) setFocusIdx(0);
  }, [focusIdx, mainCount]);

  useGamepadMenu((ev) => {
    if (confirmReset) {
      if (ev.dirX !== 0 || ev.dirY !== 0) {
        audio.playFootstep();
        setConfirmIdx((i) => (i === 0 ? 1 : 0));
      } else if (ev.cancel) {
        setConfirmReset(false);
      } else if (ev.confirm) {
        gamepadManager.suppressMenu(200);
        if (confirmIdx === 0) {
          setConfirmReset(false);
          onResetProgress();
        } else {
          setConfirmReset(false);
        }
      }
      return;
    }

    const delta = ev.dirX !== 0 ? ev.dirX : ev.dirY;
    if (delta !== 0) {
      audio.playFootstep();
      setFocusIdx((i) => (i + delta + mainCount) % mainCount);
    } else if (ev.confirm || ev.pause) {
      gamepadManager.suppressMenu(200);
      if (focusIdx === 0) onStartAdventure();
      else if (focusIdx === 1) onWatchIntro();
      else if (focusIdx === 2 && hasProgress) {
        setConfirmIdx(1);
        setConfirmReset(true);
      }
    }
  });

  // Mini animated 8-bit parade banner showing Fierio and the 8 kittens
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const frame = Math.floor(t * 60);
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const grad = ctx.createLinearGradient(0, 0, 0, 66);
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(1, '#1E3A5F');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 320, 66);
          // Subtle stars
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(48, 12, 1, 1);
          ctx.fillRect(142, 9, 2, 2);
          ctx.fillRect(236, 15, 1, 1);
          // 16-bit shaded grass turf
          ctx.fillStyle = '#4ADE80';
          ctx.fillRect(0, 64, 320, 2);
          ctx.fillStyle = '#16A34A';
          ctx.fillRect(0, 66, 320, 4);
          ctx.fillStyle = '#78350F';
          ctx.fillRect(0, 70, 320, 8);
          ctx.fillStyle = '#451A03';
          ctx.fillRect(0, 75, 320, 3);

          // Animated 16-bit Fierio walking on the left
          drawFierio(ctx, 36, 66, {
            pose: 'run',
            frame,
            facing: 1,
            hasFlameShield: progress.rescuedStages.includes(5),
            hasStarCrown: progress.rescuedStages.includes(8),
            scale: 1.85,
            castShadow: true,
          });

          // All 8 kittens lined up!
          STAGES.forEach((st, i) => {
            const rescued = progress.rescuedStages.includes(st.id);
            drawKitten(ctx, 84 + i * 30, 66, st.kitten, {
              facing: -1,
              frame: frame + i * 7,
              happy: rescued,
              scale: 1.0,
              castShadow: true,
            });
          });

          drawFeather(ctx, 304, 28, t * 2);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [progress.rescuedStages]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Hero Column */}
        <div className="lg:col-span-7 bg-[#1E253B] border-2 border-[#364266] p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span className="text-[#FEF08A] font-medium">16-Bit Adventure Platformer</span>
              <span aria-hidden="true">·</span>
              <span>8 Stages</span>
              <span aria-hidden="true">·</span>
              <span>8 Dragon Abilities</span>
            </div>

            <h1 className="font-[var(--font-pixel)] text-2xl sm:text-4xl text-[#F8FAFC] leading-tight">
              Fierio &amp; the 8 Lost Kittens
            </h1>

            <p className="text-sm sm:text-base text-[#CBD5E1] leading-relaxed max-w-xl">
              Pitsy dashed off chasing a floating feather, and Angelica, Wizzle, D da Baller, Swipey, Ego, Mask, and Loki ran after him! Travel across an 8-stage world map—every rescued kitten meows happily, unlocks the next location, and teaches Fierio a new dragon ability.
            </p>

            {/* Live 8-bit sprite parade */}
            <div className="border-2 border-[#364266] bg-[#141826] overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                width={320}
                height={78}
                className="w-full h-20 sm:h-24 block pixel-canvas"
                aria-label="16-bit pixel art preview of Fierio and all 8 kittens"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartAdventure}
                onMouseEnter={() => setFocusIdx(0)}
                className={`inline-flex items-center gap-2 px-6 py-3 bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] font-[var(--font-pixel)] text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15] ${
                  gamepad.connected && !confirmReset && focusIdx === 0
                    ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                    : ''
                }`}
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>{hasProgress ? 'Continue Map' : 'Play Adventure'}</span>
              </button>

              <button
                type="button"
                onClick={onWatchIntro}
                onMouseEnter={() => setFocusIdx(1)}
                className={`inline-flex items-center gap-2 px-4 py-3 bg-[#2A3454] hover:bg-[#364266] text-[#F8FAFC] border-2 border-[#4B5A87] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15] ${
                  gamepad.connected && !confirmReset && focusIdx === 1
                    ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B]'
                    : ''
                }`}
              >
                <Film className="w-4 h-4 text-[#FACC15]" aria-hidden="true" />
                <span>Watch Intro</span>
              </button>

              {hasProgress && !confirmReset && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmIdx(1);
                    setConfirmReset(true);
                  }}
                  onMouseEnter={() => setFocusIdx(2)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    gamepad.connected && focusIdx === 2
                      ? 'ring-2 ring-[#FACC15] ring-offset-2 ring-offset-[#1E253B] text-[#F8FAFC]'
                      : ''
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Progress</span>
                </button>
              )}
            </div>

            {confirmReset && (
              <div className="p-3 bg-[#141826] border-2 border-[#EF233C]/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#F8FAFC]">Reset all rescued kittens and unlocked stages back to Stage 1?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onResetProgress();
                    }}
                    className={`px-3 py-1.5 bg-[#EF233C] hover:bg-[#DC1D34] text-white font-semibold cursor-pointer ${
                      gamepad.connected && confirmIdx === 0 ? 'ring-2 ring-[#FACC15]' : ''
                    }`}
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className={`px-3 py-1.5 bg-[#2A3454] hover:bg-[#364266] text-[#CBD5E1] cursor-pointer ${
                      gamepad.connected && confirmIdx === 1 ? 'ring-2 ring-[#FACC15]' : ''
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#2E3959] text-xs text-[#94A3B8] flex flex-wrap gap-x-4 gap-y-1">
              {gamepad.connected && gamepad.prompts ? (
                <>
                  <span className="text-[#86EFAC] font-medium">{gamepad.prompts.label}:</span>
                  <span>Move: {gamepad.prompts.move}</span>
                  <span>Jump / Flutter / Wall Kick: {gamepad.prompts.jump}</span>
                  <span>Fire Puff: {gamepad.prompts.fire}</span>
                  <span>Ember Dash: {gamepad.prompts.dash}</span>
                  <span>Tail Bounce: {gamepad.prompts.bounce}</span>
                  <span>Pause: {gamepad.prompts.pause}</span>
                </>
              ) : (
                <>
                  <span>Move: Arrow Keys / WASD</span>
                  <span>Jump / Flutter / Wall Kick: Space or W</span>
                  <span>Fire Puff: X / J</span>
                  <span>Ember Dash: Shift / C</span>
                  <span>Tail Bounce: Down in air</span>
                  <span>Controller: Plug in &amp; press any button</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Storybook Artwork Column (Honoring both user-uploaded Fierio artworks!) */}
        <div className="lg:col-span-5 bg-[#1E253B] border-2 border-[#364266] p-5 flex flex-col gap-4 justify-between">
          <div className="relative overflow-hidden border-2 border-[#364266] bg-[#141826] flex-1 min-h-[210px]">
            {!bookImgFailed ? (
              <img
                src="/assets/aistudio/fierio-kids-47-board-game-night_bc689877.jpg"
                alt="Fierio the dragon and the kittens gathered around a board game"
                referrerPolicy="no-referrer"
                onError={() => setBookImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-[#94A3B8]">
                Fierio &amp; the Kittens — Board Game Night
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B0E17]/90 via-[#0B0E17]/50 to-transparent px-3.5 py-2.5">
              <p className="text-xs text-[#F8FAFC] font-medium">
                Before the Great Feather Chase — Board Game Night
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#141826] border-2 border-[#364266] p-3">
            <div className="w-16 h-16 shrink-0 border-2 border-[#EF233C]/80 overflow-hidden bg-[#0B0E17]">
              {!heroImgFailed ? (
                <img
                  src="/assets/aistudio/Screenshot_20261126_153431_25bb4ae0.png"
                  alt="Fierio the charcoal-black dragon with fiery crimson spiky crest and headphones"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-[var(--font-pixel)] text-xs text-[#EF233C]">
                  FIERIO
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-[var(--font-pixel)] text-xs text-[#FEF08A]">Starring Fierio</div>
              <p className="text-xs text-[#CBD5E1] mt-1 leading-snug">
                Charcoal scales, crimson crest, spiked headphones, and 8 unlockable kitten powers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
