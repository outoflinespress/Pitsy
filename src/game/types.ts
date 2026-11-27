export type GameScreenState =
  | 'TITLE_MENU'
  | 'INTRO_CUTSCENE'
  | 'WORLD_MAP'
  | 'PLAYING'
  | 'GRAND_REUNION';

export type AbilityId =
  | 'wing_flutter'
  | 'fire_puff'
  | 'tail_bounce'
  | 'ember_dash'
  | 'flame_shield'
  | 'wall_kick'
  | 'double_flap'
  | 'star_crown';

export type KittenAccessory =
  | 'halo_ribbon'
  | 'wizard_hat'
  | 'headband'
  | 'scarf'
  | 'shades_bow'
  | 'eye_mask'
  | 'trickster_tuft'
  | 'leaf_crown';

export interface KittenInfo {
  id: number;
  name: string;
  coatColor: string;
  bellyColor: string;
  stripeColor: string;
  accentColor: string;
  accessory: KittenAccessory;
  meowPitch: number;
  bio: string;
  holdsLeaf?: boolean;
}

export interface AbilityInfo {
  id: AbilityId;
  stageId: number;
  kittenName: string;
  name: string;
  keyHint: string;
  shortDesc: string;
  color: string;
}

export interface BiomePalette {
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  hillBack: string;
  hillFront: string;
  groundTop: string;
  groundMid: string;
  groundDark: string;
  brickMain: string;
  brickLight: string;
  brickDark: string;
  accent: string;
  isNight?: boolean;
}

export type EnemyKind = 'mouse' | 'yarn' | 'spark' | 'die';

export interface EnemySpawn {
  kind: EnemyKind;
  tileX: number;
  tileY: number;
  patrolMinX: number;
  patrolMaxX: number;
  speed: number;
}

export interface MovingPlatformDef {
  tileX: number;
  tileY: number;
  widthTiles: number;
  axis: 'x' | 'y';
  rangeTiles: number;
  speed: number;
}

export interface StageBlueprint {
  id: number;
  name: string;
  subtitle: string;
  landmarkType: 'meadow' | 'rooftop' | 'fern' | 'cushion' | 'domino' | 'cavern' | 'attic' | 'castle';
  mapPos: { x: number; y: number };
  palette: BiomePalette;
  kitten: KittenInfo;
  rewardAbility: AbilityInfo;
  tipText: string;
  grid: string[]; // 17 rows tall (272px at 16px tile, rendered in 480x270 viewport)
  enemies: EnemySpawn[];
  movingPlatforms: MovingPlatformDef[];
}

export interface PlayerProgress {
  highestUnlockedStage: number; // 1..8
  rescuedStages: number[];
  unlockedAbilities: AbilityId[]; // Persists across New Game+ (Round 2)
  pitsySaves: number; // 0 = Round 1, 1 = saved Pitsy once (Round 2), 2+ = True Victory
  victoryUnlocked: boolean;
  introSeen: boolean;
  bestTreatsByStage: Record<number, { collected: number; total: number }>;
  pendingUnlockStage: number | null;
}
