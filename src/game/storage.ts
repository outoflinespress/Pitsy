import { AbilityId, PlayerProgress } from './types';
import { STAGES } from './stages';

const STORAGE_KEY = 'fierio_8_lost_kittens_v1';

export const DEFAULT_PROGRESS: PlayerProgress = {
  highestUnlockedStage: 1,
  rescuedStages: [],
  introSeen: false,
  bestTreatsByStage: {},
  pendingUnlockStage: null,
};

export function loadProgress(): PlayerProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const rescued = Array.isArray(parsed.rescuedStages)
      ? Array.from(new Set(parsed.rescuedStages.filter((n) => typeof n === 'number' && n >= 1 && n <= 8))).sort(
          (a, b) => a - b
        )
      : [];
    // Enforce strict sequential unlock invariant: highest unlocked is 1 + count of consecutive rescued from 1
    let maxUnlocked = 1;
    for (let s = 1; s <= 8; s++) {
      if (rescued.includes(s)) {
        maxUnlocked = Math.min(8, s + 1);
      } else {
        break;
      }
    }
    return {
      highestUnlockedStage: maxUnlocked,
      rescuedStages: rescued,
      introSeen: Boolean(parsed.introSeen),
      bestTreatsByStage: parsed.bestTreatsByStage && typeof parsed.bestTreatsByStage === 'object'
        ? parsed.bestTreatsByStage
        : {},
      pendingUnlockStage: null,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    const toStore: PlayerProgress = {
      ...progress,
      pendingUnlockStage: null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export function resetProgressStorage(): PlayerProgress {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return { ...DEFAULT_PROGRESS };
}

export function getUnlockedAbilities(rescuedStages: number[]): Set<AbilityId> {
  const set = new Set<AbilityId>();
  for (const stage of STAGES) {
    if (rescuedStages.includes(stage.id)) {
      set.add(stage.rewardAbility.id);
    }
  }
  return set;
}
