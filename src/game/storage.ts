import { AbilityId, PlayerProgress } from './types';
import { STAGES } from './stages';

const STORAGE_KEY = 'fierio_8_lost_kittens_v1';

export const ALL_ABILITY_IDS: AbilityId[] = STAGES.map((s) => s.rewardAbility.id);

export const DEFAULT_PROGRESS: PlayerProgress = {
  highestUnlockedStage: 1,
  rescuedStages: [],
  unlockedAbilities: [],
  pitsySaves: 0,
  victoryUnlocked: false,
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

    const validAbilitySet = new Set<AbilityId>(ALL_ABILITY_IDS);
    const mergedAbilities = new Set<AbilityId>();
    if (Array.isArray(parsed.unlockedAbilities)) {
      for (const ab of parsed.unlockedAbilities) {
        if (typeof ab === 'string' && validAbilitySet.has(ab as AbilityId)) {
          mergedAbilities.add(ab as AbilityId);
        }
      }
    }
    for (const stage of STAGES) {
      if (rescued.includes(stage.id)) {
        mergedAbilities.add(stage.rewardAbility.id);
      }
    }

    const pitsySaves =
      typeof parsed.pitsySaves === 'number' && parsed.pitsySaves >= 0
        ? Math.floor(parsed.pitsySaves)
        : rescued.includes(8)
        ? 1
        : 0;

    return {
      highestUnlockedStage: maxUnlocked,
      rescuedStages: rescued,
      unlockedAbilities: Array.from(mergedAbilities),
      pitsySaves,
      victoryUnlocked: Boolean(parsed.victoryUnlocked) || pitsySaves >= 2,
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

export function getUnlockedAbilities(
  rescuedStages: number[],
  persistedAbilities: AbilityId[] = []
): Set<AbilityId> {
  const set = new Set<AbilityId>(persistedAbilities);
  for (const stage of STAGES) {
    if (rescuedStages.includes(stage.id)) {
      set.add(stage.rewardAbility.id);
    }
  }
  return set;
}
