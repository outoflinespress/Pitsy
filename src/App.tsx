import { useCallback, useMemo, useState } from 'react';
import { GameScreenState, PlayerProgress } from './game/types';
import { STAGES, getStageById } from './game/stages';
import {
  ALL_ABILITY_IDS,
  getUnlockedAbilities,
  loadProgress,
  resetProgressStorage,
  saveProgress,
} from './game/storage';
import { audio } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { IntroCutscene } from './components/IntroCutscene';
import { WorldMapView } from './components/WorldMapView';
import { PlatformerStage } from './components/PlatformerStage';
import { GrandReunionModal } from './components/GrandReunionModal';
import { gamepadManager, useGamepadStatus } from './game/gamepad';
import { Film, Gamepad2, Home, Map, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [screen, setScreen] = useState<GameScreenState>('TITLE_MENU');
  const [selectedStageId, setSelectedStageId] = useState<number>(() => {
    const loaded = loadProgress();
    return loaded.highestUnlockedStage;
  });
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const gamepadStatus = useGamepadStatus();

  const navigateScreen = useCallback((next: GameScreenState) => {
    gamepadManager.suppressMenu(220);
    gamepadManager.clearGameplayEdges();
    setScreen(next);
  }, []);

  const unlockedAbilities = useMemo(
    () => getUnlockedAbilities(progress.rescuedStages, progress.unlockedAbilities),
    [progress.rescuedStages, progress.unlockedAbilities]
  );

  const updateProgress = useCallback((updater: (prev: PlayerProgress) => PlayerProgress) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const handleToggleMute = () => {
    audio.unlock();
    const nowMuted = audio.toggleMute();
    setMuted(nowMuted);
  };

  const handleStartAdventure = () => {
    audio.unlock();
    if (!progress.introSeen) {
      navigateScreen('INTRO_CUTSCENE');
    } else {
      setSelectedStageId(progress.highestUnlockedStage);
      navigateScreen('WORLD_MAP');
    }
  };

  const handleWatchIntro = () => {
    audio.unlock();
    navigateScreen('INTRO_CUTSCENE');
  };

  const handleIntroComplete = useCallback(() => {
    updateProgress((prev) => ({ ...prev, introSeen: true }));
    setSelectedStageId(progress.highestUnlockedStage);
    navigateScreen('WORLD_MAP');
  }, [progress.highestUnlockedStage, updateProgress, navigateScreen]);

  const handleResetProgress = () => {
    const fresh = resetProgressStorage();
    setProgress(fresh);
    setSelectedStageId(1);
    setActiveStageId(1);
    audio.stopBgm();
    navigateScreen('TITLE_MENU');
  };

  const handleEnterStage = (stageId: number) => {
    if (stageId > progress.highestUnlockedStage) return;
    audio.unlock();
    setActiveStageId(stageId);
    navigateScreen('PLAYING');
  };

  const handleStageClear = useCallback(
    (stageId: number, treatsCollected: number, treatsTotal: number) => {
      const stageData = getStageById(stageId);
      updateProgress((prev) => {
        const wasNewRescue = !prev.rescuedStages.includes(stageId);
        const rescuedStages = wasNewRescue
          ? [...prev.rescuedStages, stageId].sort((a, b) => a - b)
          : prev.rescuedStages;

        const nextUnlocked = Math.min(8, Math.max(prev.highestUnlockedStage, stageId + 1));
        const unlockedANewStage = nextUnlocked > prev.highestUnlockedStage;

        const mergedAbilities = prev.unlockedAbilities.includes(stageData.rewardAbility.id)
          ? prev.unlockedAbilities
          : [...prev.unlockedAbilities, stageData.rewardAbility.id];

        const nextPitsySaves =
          stageId === 8 && wasNewRescue ? prev.pitsySaves + 1 : prev.pitsySaves;
        const victoryUnlocked = prev.victoryUnlocked || nextPitsySaves >= 2;

        const prevBest = prev.bestTreatsByStage[stageId]?.collected ?? 0;
        const bestTreatsByStage = {
          ...prev.bestTreatsByStage,
          [stageId]: {
            collected: Math.max(prevBest, treatsCollected),
            total: treatsTotal,
          },
        };

        return {
          ...prev,
          rescuedStages,
          unlockedAbilities: mergedAbilities,
          pitsySaves: nextPitsySaves,
          victoryUnlocked,
          highestUnlockedStage: nextUnlocked,
          bestTreatsByStage,
          pendingUnlockStage: unlockedANewStage ? nextUnlocked : prev.pendingUnlockStage,
        };
      });
    },
    [updateProgress]
  );

  const handleStartRoundTwo = useCallback(() => {
    updateProgress((prev) => ({
      ...prev,
      highestUnlockedStage: 1,
      rescuedStages: [],
      unlockedAbilities: [...ALL_ABILITY_IDS],
      pitsySaves: Math.max(1, prev.pitsySaves),
      introSeen: true,
      pendingUnlockStage: null,
    }));
    setSelectedStageId(1);
    setActiveStageId(1);
    navigateScreen('WORLD_MAP');
  }, [updateProgress, navigateScreen]);

  const handleExitStageToMap = () => {
    if (activeStageId === 8 && progress.rescuedStages.includes(8)) {
      navigateScreen('GRAND_REUNION');
    } else {
      navigateScreen('WORLD_MAP');
    }
  };

  const handleConsumePendingUnlock = useCallback(() => {
    setProgress((prev) => ({ ...prev, pendingUnlockStage: null }));
  }, []);

  const totalTreatsSummary = useMemo(() => {
    let collected = 0;
    let max = 0;
    for (const st of STAGES) {
      let stMax = 0;
      for (const row of st.grid) {
        for (const ch of row) {
          if (ch === 'T') stMax++;
        }
      }
      max += stMax;
      collected += progress.bestTreatsByStage[st.id]?.collected ?? 0;
    }
    return { collected, max };
  }, [progress.bestTreatsByStage]);

  const activeStage = getStageById(activeStageId);

  return (
    <div className="min-h-screen bg-[#141826] text-[#F8FAFC] flex flex-col">
      {/* Clean Single-Row Top Bar (3-Zone Contract) */}
      <header className="border-b-2 border-[#26304D] bg-[#181E30] px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Title */}
          <button
            type="button"
            onClick={() => {
              audio.stopBgm();
              setScreen('TITLE_MENU');
            }}
            className="font-[var(--font-pixel)] text-sm sm:text-base text-[#F8FAFC] hover:text-[#FEF08A] transition-colors cursor-pointer whitespace-nowrap shrink-0 text-left"
          >
            Fierio &amp; the 8 Kittens
          </button>

          {/* Zone 2: Clean Single-Line Nav Controls */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#CBD5E1]" aria-label="Game Navigation">
            <button
              type="button"
              onClick={() => {
                audio.stopBgm();
                setScreen('TITLE_MENU');
              }}
              className={`inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                screen === 'TITLE_MENU' ? 'text-[#FEF08A] underline underline-offset-4' : ''
              }`}
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Title</span>
            </button>
            <button
              type="button"
              onClick={handleWatchIntro}
              className={`inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                screen === 'INTRO_CUTSCENE' ? 'text-[#FEF08A] underline underline-offset-4' : ''
              }`}
            >
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Intro Story</span>
            </button>
            <button
              type="button"
              onClick={() => {
                audio.unlock();
                setScreen('WORLD_MAP');
              }}
              className={`inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                screen === 'WORLD_MAP' ? 'text-[#FEF08A] underline underline-offset-4' : ''
              }`}
            >
              <Map className="w-3.5 h-3.5" aria-hidden="true" />
              <span>World Map</span>
            </button>
            <span className="text-xs font-[var(--font-mono)] tabular-nums text-[#94A3B8] whitespace-nowrap shrink-0">
              Kittens {progress.rescuedStages.length}/8
            </span>
            {gamepadStatus.connected && gamepadStatus.prompts && (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-[#86EFAC] whitespace-nowrap shrink-0"
                title={gamepadStatus.id}
              >
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{gamepadStatus.prompts.shortLabel}</span>
              </span>
            )}
          </nav>

          {/* Zone 3: Single Primary Utility Action (Audio Mute Toggle) */}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#212942] hover:bg-[#2A3454] text-[#F8FAFC] border border-[#3A486E] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FACC15]"
          >
            {muted ? (
              <>
                <VolumeX className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-[#FACC15]" aria-hidden="true" />
                <span>Sound On</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Active Game Screen */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-5 sm:py-7">
        {screen === 'TITLE_MENU' && (
          <TitleScreen
            progress={progress}
            onStartAdventure={handleStartAdventure}
            onWatchIntro={handleWatchIntro}
            onResetProgress={handleResetProgress}
          />
        )}

        {screen === 'INTRO_CUTSCENE' && (
          <IntroCutscene onComplete={handleIntroComplete} />
        )}

        {screen === 'WORLD_MAP' && (
          <WorldMapView
            progress={progress}
            selectedStageId={selectedStageId}
            onSelectStage={setSelectedStageId}
            onEnterStage={handleEnterStage}
            onConsumePendingUnlock={handleConsumePendingUnlock}
            onOpenReunion={() => navigateScreen('GRAND_REUNION')}
          />
        )}

        {screen === 'PLAYING' && (
          <PlatformerStage
            stage={activeStage}
            unlockedAbilities={unlockedAbilities}
            alreadyRescued={progress.rescuedStages.includes(activeStage.id)}
            pitsySaves={progress.pitsySaves}
            onStageClear={handleStageClear}
            onExitToMap={handleExitStageToMap}
          />
        )}

        {screen === 'GRAND_REUNION' && (
          <GrandReunionModal
            endingMode={
              progress.pitsySaves >= 2 || progress.victoryUnlocked ? 'true_victory' : 'loop_1'
            }
            totalTreats={totalTreatsSummary.collected}
            maxTreats={totalTreatsSummary.max}
            onStartRoundTwo={handleStartRoundTwo}
            onExploreMap={() => navigateScreen('WORLD_MAP')}
            onPlayAgain={() => {
              const fresh = resetProgressStorage();
              setProgress(fresh);
              setSelectedStageId(1);
              navigateScreen('INTRO_CUTSCENE');
            }}
          />
        )}
      </main>
    </div>
  );
}
