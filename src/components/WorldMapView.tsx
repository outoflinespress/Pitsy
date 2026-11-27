import React, { useEffect, useRef, useState } from 'react';
import { STAGES } from '../game/stages';
import { PlayerProgress, StageBlueprint } from '../game/types';
import { drawFierio, drawKitten, drawMapLandmark, drawPadlock } from '../game/sprites';
import { audio } from '../game/audio';
import { gamepadManager, useGamepadMenu, useGamepadStatus } from '../game/gamepad';
import { Check, Lock, Play, Sparkles } from 'lucide-react';

interface WorldMapViewProps {
  progress: PlayerProgress;
  selectedStageId: number;
  onSelectStage: (stageId: number) => void;
  onEnterStage: (stageId: number) => void;
  onConsumePendingUnlock: () => void;
  onOpenReunion: () => void;
}

const W = 480;
const H = 270;

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  progress,
  selectedStageId,
  onSelectStage,
  onEnterStage,
  onConsumePendingUnlock,
  onOpenReunion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [shakingStageId, setShakingStageId] = useState<number | null>(null);
  const [unlockAnimProgress, setUnlockAnimProgress] = useState<number>(1);
  const [unlockingStageId, setUnlockingStageId] = useState<number | null>(null);
  const gamepad = useGamepadStatus();

  // Fierio's visual position on the map (smoothly walks between nodes)
  const initialStage = STAGES.find((s) => s.id === selectedStageId) ?? STAGES[0];
  const walkerRef = useRef({
    x: initialStage.mapPos.x,
    y: initialStage.mapPos.y,
    targetX: initialStage.mapPos.x,
    targetY: initialStage.mapPos.y,
    facing: 1 as 1 | -1,
    moving: false,
  });

  // Start gentle world-map chiptune BGM
  useEffect(() => {
    audio.startBgm('map');
  }, []);

  // Trigger dramatic trail-unlock & padlock-pop animation when returning after a new rescue
  useEffect(() => {
    if (progress.pendingUnlockStage && progress.pendingUnlockStage >= 2) {
      const targetId = progress.pendingUnlockStage;
      const prevStage = STAGES.find((s) => s.id === targetId - 1);
      if (prevStage) {
        walkerRef.current.x = prevStage.mapPos.x;
        walkerRef.current.y = prevStage.mapPos.y;
      }
      setUnlockingStageId(targetId);
      setUnlockAnimProgress(0);
      audio.playUnlockFanfare();

      const start = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1150);
        setUnlockAnimProgress(p);
        if (p < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          onSelectStage(targetId);
          onConsumePendingUnlock();
          window.setTimeout(() => setUnlockingStageId(null), 500);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
  }, [progress.pendingUnlockStage, onConsumePendingUnlock, onSelectStage]);

  // Update walker target when selectedStageId changes (if unlocked)
  useEffect(() => {
    const st = STAGES.find((s) => s.id === selectedStageId);
    if (st && st.id <= progress.highestUnlockedStage) {
      const dx = st.mapPos.x - walkerRef.current.x;
      if (Math.abs(dx) > 2) {
        walkerRef.current.facing = dx >= 0 ? 1 : -1;
      }
      walkerRef.current.targetX = st.mapPos.x;
      walkerRef.current.targetY = st.mapPos.y;
      setLockedNotice(null);
    }
  }, [selectedStageId, progress.highestUnlockedStage]);

  // Keyboard navigation across the world map
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        const next = Math.min(8, selectedStageId + 1);
        handleNodeClick(STAGES[next - 1]);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const prev = Math.max(1, selectedStageId - 1);
        handleNodeClick(STAGES[prev - 1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (selectedStageId <= progress.highestUnlockedStage) {
          audio.unlock();
          onEnterStage(selectedStageId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedStageId, progress.highestUnlockedStage]);

  useGamepadMenu((ev) => {
    if (ev.dirX > 0 || ev.dirY < 0) {
      const next = Math.min(8, selectedStageId + 1);
      if (next !== selectedStageId) handleNodeClick(STAGES[next - 1]);
    } else if (ev.dirX < 0 || ev.dirY > 0) {
      const prev = Math.max(1, selectedStageId - 1);
      if (prev !== selectedStageId) handleNodeClick(STAGES[prev - 1]);
    } else if (ev.confirm || ev.pause) {
      const curr = STAGES[selectedStageId - 1];
      if (curr) {
        if (curr.id <= progress.highestUnlockedStage) {
          audio.unlock();
          gamepadManager.suppressMenu(240);
          onEnterStage(curr.id);
        } else {
          handleNodeClick(curr);
        }
      }
    }
  });

  const handleNodeClick = (stage: StageBlueprint) => {
    audio.unlock();
    const isUnlocked = stage.id <= progress.highestUnlockedStage;
    if (!isUnlocked) {
      audio.playLockClink();
      gamepadManager.rumble('lock');
      const prevStage = STAGES[stage.id - 2];
      setLockedNotice(
        `Stage ${stage.id} is locked — rescue ${prevStage.kitten.name} in Stage ${prevStage.id} (${prevStage.name}) first.`
      );
      setShakingStageId(stage.id);
      onSelectStage(stage.id);
      window.setTimeout(() => setShakingStageId((curr) => (curr === stage.id ? null : curr)), 450);
      return;
    }

    if (stage.id === selectedStageId) {
      onEnterStage(stage.id);
    } else {
      audio.playFootstep();
      onSelectStage(stage.id);
    }
  };

  // Interactive canvas click hit-detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * W;
    const cy = ((e.clientY - rect.top) / rect.height) * H;

    let closest: StageBlueprint | null = null;
    let bestDist = 32;
    for (const st of STAGES) {
      const dist = Math.hypot(cx - st.mapPos.x, cy - (st.mapPos.y - 4));
      if (dist < bestDist) {
        bestDist = dist;
        closest = st;
      }
    }
    if (closest) {
      handleNodeClick(closest);
    }
  };

  // Render the animated 8-bit overworld map
  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const drawLoop = (now: number) => {
      const time = (now - start) / 1000;
      const frame = Math.floor(time * 60);

      // Smoothly walk Fierio toward target unlocked node
      const w = walkerRef.current;
      const dx = w.targetX - w.x;
      const dy = w.targetY - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1.5) {
        const speed = 2.6;
        w.x += (dx / dist) * Math.min(speed, dist);
        w.y += (dy / dist) * Math.min(speed, dist);
        w.moving = true;
      } else {
        w.x = w.targetX;
        w.y = w.targetY;
        w.moving = false;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;

          // --- 16-BIT OCEAN GRADIENT & SPARKLING WAVES ---
          const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
          seaGrad.addColorStop(0, '#0C4A6E');
          seaGrad.addColorStop(0.5, '#1D4ED8');
          seaGrad.addColorStop(1, '#1E3A8A');
          ctx.fillStyle = seaGrad;
          ctx.fillRect(0, 0, W, H);

          // Animated turquoise wave crests & sparkles
          for (let wy = 12; wy < H; wy += 22) {
            for (let wx = wy % 44 === 12 ? 6 : 24; wx < W; wx += 44) {
              const waveShift = Math.round(Math.sin(time * 2.1 + wy * 0.2) * 3);
              ctx.fillStyle = '#38BDF8';
              ctx.fillRect(wx + waveShift, wy, 14, 2);
              ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
              ctx.fillRect(wx + waveShift + 3, wy, 6, 1);
            }
          }

          // --- 16-BIT COASTAL SHALLOWS & FOAMING SHORELINE ---
          const foamPulse = Math.floor(time * 2.5) % 2;
          ctx.fillStyle = '#06B6D4';
          ctx.fillRect(14 - foamPulse, 40 - foamPulse, 452 + foamPulse * 2, 212 + foamPulse * 2);
          ctx.fillRect(30 - foamPulse, 26 - foamPulse, 420 + foamPulse * 2, 238 + foamPulse * 2);
          ctx.fillStyle = 'rgba(240, 249, 255, 0.55)';
          ctx.fillRect(18, 43, 444, 206);
          ctx.fillRect(34, 29, 412, 232);

          // Southern 3D coastal cliffs / rock bluffs (SNES elevation depth!)
          ctx.fillStyle = '#78350F';
          ctx.fillRect(22, 236, 436, 13);
          ctx.fillRect(38, 246, 404, 12);
          ctx.fillStyle = '#92400E';
          ctx.fillRect(24, 236, 432, 8);
          ctx.fillRect(40, 246, 400, 6);

          // Sandy beach rim
          ctx.fillStyle = '#FDE68A';
          ctx.fillRect(22, 46, 436, 194);
          ctx.fillRect(38, 32, 404, 218);
          ctx.fillStyle = '#FEF3C7';
          ctx.fillRect(24, 46, 432, 4);

          // --- MULTI-BIOME 16-BIT ISLAND TERRAIN ---
          // Deep lush emerald base
          ctx.fillStyle = '#16A34A';
          ctx.fillRect(28, 52, 424, 182);
          ctx.fillRect(44, 38, 392, 204);
          // Sunlit meadow terrace (Stages 1-3)
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(32, 128, 190, 102);
          ctx.fillStyle = '#4ADE80';
          ctx.fillRect(38, 136, 168, 86);
          // Lavender pillow highlands (Stage 4)
          ctx.fillStyle = '#7C3AED';
          ctx.fillRect(202, 92, 94, 78);
          ctx.fillStyle = '#A78BFA';
          ctx.fillRect(206, 95, 86, 68);
          // Rocky cavern & twilight castle peaks (Stages 6-8)
          ctx.fillStyle = '#334155';
          ctx.fillRect(316, 40, 136, 148);
          ctx.fillStyle = '#475569';
          ctx.fillRect(322, 44, 124, 132);
          ctx.fillStyle = '#1E1B4B';
          ctx.fillRect(356, 44, 88, 66);

          // Shaded 16-bit pixel trees & meadow wildflowers
          const trees = [
            [42, 112], [74, 94], [94, 224], [150, 226], [198, 128],
            [264, 218], [334, 212], [296, 86],
          ];
          trees.forEach(([tx, ty]) => {
            ctx.fillStyle = 'rgba(11, 14, 23, 0.25)';
            ctx.fillRect(tx - 4, ty, 9, 2);
            ctx.fillStyle = '#78350F';
            ctx.fillRect(tx - 1, ty - 3, 3, 4);
            ctx.fillStyle = '#14532D';
            ctx.fillRect(tx - 5, ty - 9, 10, 7);
            ctx.fillStyle = '#16A34A';
            ctx.fillRect(tx - 4, ty - 12, 8, 7);
            ctx.fillStyle = '#86EFAC';
            ctx.fillRect(tx - 3, ty - 12, 4, 2);
          });
          // Wildflower specks in meadow
          const flowers: [number, number, string][] = [
            [68, 174, '#FEF08A'], [92, 198, '#F472B6'], [138, 210, '#FEF08A'],
            [168, 168, '#FFFFFF'], [84, 148, '#F472B6'], [220, 194, '#FEF08A'],
          ];
          flowers.forEach(([fx, fy, col]) => {
            ctx.fillStyle = col;
            ctx.fillRect(fx, fy, 2, 2);
          });

          // Ornate 16-bit map nameplate in top-left corner
          ctx.fillStyle = '#0B0E17';
          ctx.fillRect(9, 7, 178, 22);
          ctx.fillStyle = '#1E253B';
          ctx.fillRect(11, 9, 174, 18);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(11, 9, 174, 2);
          ctx.fillRect(11, 25, 174, 1);
          ctx.fillStyle = '#FEF08A';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('FIERIO 16-BIT WORLD MAP', 19, 21);

          // --- WINDING 16-BIT BEVELED BOARD-GAME TRAILS (STAGES 1 -> 8) ---
          for (let i = 0; i < STAGES.length - 1; i++) {
            const a = STAGES[i];
            const b = STAGES[i + 1];
            const segmentUnlocked = b.id <= progress.highestUnlockedStage;
            const isAnimatingThis = unlockingStageId === b.id;

            const steps = 16;
            for (let s = 1; s < steps; s++) {
              const frac = s / steps;
              const curve = Math.sin(frac * Math.PI) * (i % 2 === 0 ? -10 : 10);
              const px = Math.round(a.mapPos.x + (b.mapPos.x - a.mapPos.x) * frac);
              const py = Math.round(a.mapPos.y + (b.mapPos.y - a.mapPos.y) * frac + curve);

              const lit = isAnimatingThis ? frac <= unlockAnimProgress : segmentUnlocked;
              if (lit) {
                ctx.fillStyle = '#451A03';
                ctx.fillRect(px - 3, py - 3, 7, 7);
                ctx.fillStyle = '#F59E0B';
                ctx.fillRect(px - 2, py - 2, 5, 5);
                ctx.fillStyle = '#FEF08A';
                ctx.fillRect(px - 2, py - 2, 4, 2);
              } else if (s % 2 === 0) {
                ctx.fillStyle = '#0F172A';
                ctx.fillRect(px - 2, py - 2, 5, 5);
                ctx.fillStyle = '#64748B';
                ctx.fillRect(px - 1, py - 1, 3, 3);
              }
            }
          }

          // --- STAGE LANDMARKS, BEVELED MEDALLIONS, LOCKS & KITTENS ---
          const hasFlameShield =
            progress.rescuedStages.includes(5) || progress.unlockedAbilities.includes('flame_shield');
          const hasStarCrown =
            progress.rescuedStages.includes(8) || progress.unlockedAbilities.includes('star_crown');

          for (const st of STAGES) {
            const isUnlocked = st.id <= progress.highestUnlockedStage;
            const isCleared = progress.rescuedStages.includes(st.id);
            const isSelected = st.id === selectedStageId;
            const isUnlockingNow = unlockingStageId === st.id && unlockAnimProgress < 0.92;
            const shakeX = shakingStageId === st.id ? Math.round(Math.sin(time * 55) * 3) : 0;

            drawMapLandmark(ctx, st.mapPos.x, st.mapPos.y - 6, st.landmarkType, isUnlocked && !isUnlockingNow, time);

            // Beveled 16-bit stage medallion
            const padX = st.mapPos.x;
            const padY = st.mapPos.y;
            if (isSelected) {
              const pulse = Math.floor(time * 4) % 2;
              ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
              ctx.fillRect(padX - 16 - pulse, padY - 9 - pulse, 32 + pulse * 2, 18 + pulse * 2);
              ctx.fillStyle = '#FEF08A';
              ctx.fillRect(padX - 13 - pulse, padY - 7 - pulse, 26 + pulse * 2, 14 + pulse * 2);
            }
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(padX - 11, padY - 5, 22, 11);
            ctx.fillStyle = isCleared ? '#15803D' : isUnlocked && !isUnlockingNow ? '#991B1B' : '#334155';
            ctx.fillRect(padX - 10, padY - 4, 20, 9);
            ctx.fillStyle = isCleared ? '#22C55E' : isUnlocked && !isUnlockingNow ? '#EF233C' : '#64748B';
            ctx.fillRect(padX - 10, padY - 4, 20, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(padX - 9, padY - 4, 18, 2);

            // Stage number plaque below pad
            ctx.fillStyle = '#0B0E17';
            ctx.fillRect(padX - 7, padY + 6, 14, 11);
            ctx.fillStyle = '#1E253B';
            ctx.fillRect(padX - 6, padY + 7, 12, 9);
            ctx.fillStyle = isCleared ? '#86EFAC' : isUnlocked ? '#FEF08A' : '#94A3B8';
            ctx.font = 'bold 8px monospace';
            ctx.fillText(String(st.id), padX - 2.5, padY + 14.5);

            if (!isUnlocked || isUnlockingNow) {
              drawPadlock(ctx, padX, padY - 3, shakeX);
            } else if (isCleared) {
              drawKitten(ctx, padX + 16, padY + 4, st.kitten, {
                facing: -1,
                frame,
                happy: true,
                scale: 0.78,
                castShadow: true,
              });
            }

            if (unlockingStageId === st.id && unlockAnimProgress >= 0.85) {
              ctx.fillStyle = '#FEF08A';
              for (let k = 0; k < 8; k++) {
                const ang = (k / 8) * Math.PI * 2 + time * 4;
                const rad = (unlockAnimProgress - 0.85) * 145;
                ctx.fillRect(
                  Math.round(padX + Math.cos(ang) * rad),
                  Math.round(padY - 6 + Math.sin(ang) * rad),
                  3,
                  3
                );
              }
            }
          }

          // --- FIERIO OVERWORLD AVATAR ---
          drawFierio(ctx, w.x, w.y + 1, {
            facing: w.facing,
            pose: w.moving ? 'run' : 'idle',
            frame,
            hasFlameShield,
            hasStarCrown,
            scale: 1.4,
            castShadow: true,
          });

          // Soft drifting translucent 16-bit sky clouds passing gently over the map
          for (let c = 0; c < 3; c++) {
            const cx = Math.floor(((time * 9 + c * 175) % (W + 80)) - 40);
            const cy = 34 + c * 74;
            ctx.fillStyle = 'rgba(11, 14, 23, 0.08)';
            ctx.fillRect(cx + 6, cy + 16, 36, 8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(cx, cy, 38, 8);
            ctx.fillRect(cx + 7, cy - 5, 22, 6);
          }
        }
      }

      rafId = requestAnimationFrame(drawLoop);
    };

    rafId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(rafId);
  }, [progress, selectedStageId, shakingStageId, unlockingStageId, unlockAnimProgress]);

  const selectedStage = STAGES.find((s) => s.id === selectedStageId) ?? STAGES[0];
  const isSelectedUnlocked = selectedStage.id <= progress.highestUnlockedStage;
  const isSelectedCleared = progress.rescuedStages.includes(selectedStage.id);
  const treatsRecord = progress.bestTreatsByStage[selectedStage.id];
  const allCleared = progress.rescuedStages.length === 8;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
      {/* Interactive 8-Bit World Map Canvas */}
      <div className="relative bg-[#0B0E17] border-2 border-[#364266] pixel-frame overflow-hidden">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleCanvasClick}
          className="w-full aspect-video block pixel-canvas cursor-pointer"
          aria-label="Interactive 8-stage Fierio world map. Click an unlocked stage or use arrow keys to travel."
        />

        {/* Accessible Quick-Select Overlay Notice for Locked Stage */}
        {lockedNotice && (
          <div
            role="status"
            className="absolute bottom-3 left-3 right-3 sm:right-auto bg-[#141826]/95 border-2 border-[#FACC15] px-3.5 py-2 text-xs text-[#FEF08A] flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5 shrink-0 text-[#FACC15]" aria-hidden="true" />
            <span>{lockedNotice}</span>
          </div>
        )}
      </div>

      {/* Round 2 (New Game+) Banner: Pitsy chased another maple leaf, all upgrades kept! */}
      {progress.pitsySaves === 1 && !progress.victoryUnlocked && (
        <div className="bg-[#1E253B] border-2 border-[#F97316] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-2 text-[#FEF08A]">
            <Sparkles className="w-4 h-4 text-[#F97316] shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-[var(--font-pixel)] text-[#FDBA74]">Round 2!</strong> Pitsy chased another maple leaf and all 8 kittens ran off again—rescue them with <strong className="text-[#86EFAC]">all 8 dragon upgrades kept!</strong>
            </span>
          </div>
        </div>
      )}

      {/* Stage Inspector & Launch Bar */}
      <div className="bg-[#1E253B] border-2 border-[#364266] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#94A3B8]">
            <span className="font-[var(--font-mono)] tabular-nums text-[#FACC15] font-bold">
              Stage {selectedStage.id} / 8
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-[#F8FAFC]">
              {isSelectedCleared ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" aria-hidden="true" />
                  <span className="text-[#86EFAC]">Cleared</span>
                </>
              ) : isSelectedUnlocked ? (
                <span className="text-[#FEF08A]">Unlocked</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                  <span>Locked</span>
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Kitten: <strong className="text-[#F8FAFC] font-semibold">{selectedStage.kitten.name}</strong>
            </span>
            {treatsRecord && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-[var(--font-mono)] tabular-nums text-[#FACC15]">
                  Treats {treatsRecord.collected}/{treatsRecord.total}
                </span>
              </>
            )}
          </div>

          <h2 className="font-[var(--font-pixel)] text-lg sm:text-xl text-[#F8FAFC] tracking-tight">
            {selectedStage.name}
          </h2>

          <p className="text-sm text-[#CBD5E1]">
            {isSelectedUnlocked ? (
              <>
                Rescue <span className="text-[#FEF08A] font-medium">{selectedStage.kitten.name}</span> to unlock{' '}
                <span className="text-[#F8FAFC] font-medium">{selectedStage.rewardAbility.name}</span>
                {selectedStage.id < 8 ? ` and Stage ${selectedStage.id + 1}.` : ' and complete the reunion!'}
              </>
            ) : (
              <>
                Rescue <span className="text-[#FEF08A] font-medium">{STAGES[selectedStage.id - 2].kitten.name}</span> in Stage{' '}
                {selectedStage.id - 1} to unlock this location.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {(allCleared || progress.victoryUnlocked) && (
            <button
              type="button"
              onClick={onOpenReunion}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2A3454] hover:bg-[#364266] text-[#FEF08A] border-2 border-[#FACC15]/70 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15]"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>{progress.victoryUnlocked ? 'Victory Screen' : 'Ending Scene'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!isSelectedUnlocked}
            onClick={() => {
              audio.unlock();
              onEnterStage(selectedStage.id);
            }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-[var(--font-pixel)] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15] ${
              isSelectedUnlocked
                ? 'bg-[#EF233C] hover:bg-[#DC1D34] text-white border-2 border-[#FF758F] cursor-pointer'
                : 'bg-[#28314D] text-[#64748B] border-2 border-[#364266] cursor-not-allowed'
            }`}
          >
            {isSelectedUnlocked ? (
              <>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>{isSelectedCleared ? 'Replay Stage' : 'Enter Stage'}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>Locked</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 8-Kitten & Unlocked Abilities Roster Strip */}
      <div className="bg-[#1E253B] border-2 border-[#364266] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-[var(--font-pixel)] text-xs sm:text-sm text-[#F8FAFC]">
            Kitten Rescue &amp; Ability Roster
          </h3>
          <span className="text-xs text-[#94A3B8]">
            {gamepad.connected && gamepad.prompts
              ? `${gamepad.prompts.move} to travel · Press ${gamepad.prompts.confirm} to enter stage`
              : 'Click any unlocked stage below or on the map · Arrow keys + Enter supported'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STAGES.map((st) => {
            const unlocked = st.id <= progress.highestUnlockedStage;
            const rescued = progress.rescuedStages.includes(st.id);
            const hasUpgrade = rescued || progress.unlockedAbilities.includes(st.rewardAbility.id);
            const selected = st.id === selectedStageId;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleNodeClick(st)}
                className={`text-left p-2.5 border-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FACC15] ${
                  selected
                    ? 'bg-[#2A3454] border-[#FACC15]'
                    : rescued
                    ? 'bg-[#182238] border-[#22C55E]/60 hover:border-[#22C55E]'
                    : unlocked
                    ? 'bg-[#182035] border-[#4B5A87] hover:border-[#94A3B8]'
                    : 'bg-[#141929] border-[#26304D] opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-[var(--font-mono)] tabular-nums mb-1">
                  <span className={unlocked ? 'text-[#FEF08A]' : 'text-[#64748B]'}>#{st.id}</span>
                  {rescued ? (
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" aria-label="Rescued" />
                  ) : !unlocked ? (
                    <Lock className="w-3 h-3 text-[#64748B]" aria-label="Locked" />
                  ) : (
                    <span className="text-[10px] text-[#F97316] font-sans font-semibold">Next</span>
                  )}
                </div>
                <div className="font-semibold text-xs text-[#F8FAFC] truncate">
                  {st.kitten.name}
                </div>
                <div className="text-[11px] mt-0.5 truncate text-[#94A3B8]">
                  {hasUpgrade ? (
                    <span className="text-[#86EFAC]">{st.rewardAbility.name}</span>
                  ) : (
                    <span>??? Ability</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
