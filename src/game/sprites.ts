import { AbilityId, EnemyKind, KittenInfo } from './types';

export interface FierioDrawOpts {
  facing?: 1 | -1;
  pose?: 'idle' | 'run' | 'jump' | 'flutter' | 'dash' | 'bounce' | 'wall' | 'sleep' | 'surprise';
  frame?: number;
  hasFlameShield?: boolean;
  hasStarCrown?: boolean;
  scale?: number;
  castShadow?: boolean;
}

/**
 * 16-Bit SNES-style multi-tone shaded sprite renderer for Fierio:
 * Charcoal-obsidian dragon scales with cool slate rim lighting, blazing 4-tone crimson spiky mane,
 * ridged ivory curved horns, veined bat wings, banded belly plates, spade tail, and spiked headphones.
 */
export function drawFierio(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: FierioDrawOpts = {}
): void {
  const {
    facing = 1,
    pose = 'idle',
    frame = 0,
    hasFlameShield = false,
    hasStarCrown = false,
    scale = 1,
    castShadow = false,
  } = opts;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  // Soft 16-bit elliptical contact shadow beneath feet
  if (castShadow && pose !== 'sleep') {
    ctx.fillStyle = 'rgba(11, 14, 23, 0.34)';
    ctx.fillRect(-8 * scale, -1 * scale, 16 * scale, 3 * scale);
    ctx.fillRect(-6 * scale, 1 * scale, 12 * scale, 1 * scale);
  }

  ctx.scale(facing * scale, scale);

  const px = (lx: number, ly: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly, w, h);
  };

  // Rich 16-bit color ramp faithful to Fierio's charcoal & blazing crimson look
  const OUTLINE = '#0B0E17';
  const DARK = '#1A1E2C';
  const MID = '#2B3247';
  const LIT = '#424C6B';
  const SPEC = '#67749C';

  const BELLY_HI = '#A5B1CC';
  const BELLY_MID = '#7B87A6';
  const BELLY_SHADE = '#4E5873';

  const RED_DEEP = '#881326';
  const RED_MID = '#DC2626';
  const RED_BRIGHT = '#FF3B53';
  const RED_TIP = '#FF9AA7';

  const IVORY_HI = '#FFFBEB';
  const IVORY_MID = '#EADDC0';
  const IVORY_SHADE = '#B8A886';

  const METAL_DARK = '#252B3B';
  const METAL_MID = '#4A5470';
  const METAL_HI = '#94A3B8';
  const STUD = '#F8FAFC';

  // Glowing 16-bit layered Flame Shield aura
  if (hasFlameShield && pose !== 'sleep') {
    const pulse = Math.sin(frame * 0.22) * 1.2;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
    ctx.fillRect(-13 - pulse, -25 - pulse, 26 + pulse * 2, 26 + pulse * 2);
    ctx.fillStyle = 'rgba(249, 115, 22, 0.22)';
    ctx.fillRect(-11, -23, 22, 22);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
    ctx.fillRect(-11, -23, 22, 1);
    ctx.fillRect(-11, -1, 22, 1);
    ctx.fillRect(-11, -23, 1, 22);
    ctx.fillRect(10, -23, 1, 22);
  }

  // Sleeping pose for Intro Cutscene (cozy shaded dragon tucked sideways)
  if (pose === 'sleep') {
    px(-9, -12, 18, 9, OUTLINE);
    px(-8, -11, 16, 7, DARK);
    px(-7, -11, 13, 5, MID);
    px(-6, -11, 9, 2, LIT);
    // Shaded crimson crest
    px(-8, -15, 3, 4, RED_DEEP);
    px(-7, -15, 2, 3, RED_MID);
    px(-5, -16, 4, 5, RED_BRIGHT);
    px(-4, -16, 2, 2, RED_TIP);
    px(-1, -14, 3, 3, RED_MID);
    // Ridged curved ivory horn
    px(1, -16, 2, 5, IVORY_MID);
    px(2, -17, 2, 3, IVORY_HI);
    px(1, -13, 2, 1, IVORY_SHADE);
    // Snout & peaceful closed eye
    px(4, -10, 6, 6, OUTLINE);
    px(4, -9, 5, 4, MID);
    px(5, -9, 3, 2, LIT);
    px(5, -8, 3, 1, OUTLINE);
    px(8, -7, 1, 1, SPEC);
    // Shaded headphones
    px(0, -11, 4, 4, METAL_DARK);
    px(1, -10, 2, 2, METAL_MID);
    px(0, -10, 1, 1, STUD);
    ctx.restore();
    return;
  }

  const walkCycle = pose === 'run' ? Math.floor(frame / 4) % 4 : 0;
  const bob = pose === 'run' && walkCycle % 2 === 1 ? -1 : pose === 'idle' ? Math.floor(frame / 22) % 2 : 0;
  const wingUp =
    pose === 'flutter'
      ? Math.floor(frame / 2) % 2 === 0
      : pose === 'jump' || pose === 'dash'
      ? true
      : Math.floor(frame / 18) % 2 === 0;

  // --- 16-BIT SPADE TAIL ---
  if (pose === 'bounce') {
    px(-5, -3, 10, 4, OUTLINE);
    px(-4, -2, 8, 3, RED_MID);
    px(-3, -1, 6, 2, '#FACC15');
    px(-2, 0, 4, 1, '#FEF08A');
  } else {
    px(-10, -8 + bob, 6, 4, OUTLINE);
    px(-9, -7 + bob, 5, 2, DARK);
    px(-8, -7 + bob, 4, 1, LIT);
    // Sculpted crimson-edged spade tip
    px(-13, -10 + bob, 4, 4, OUTLINE);
    px(-12, -9 + bob, 3, 2, RED_MID);
    px(-13, -9 + bob, 2, 1, RED_BRIGHT);
    px(-14, -9 + bob, 1, 1, RED_TIP);
  }

  // --- 16-BIT VEINED BAT DRAGON WING ---
  if (wingUp) {
    px(-13, -19 + bob, 8, 8, OUTLINE);
    px(-12, -18 + bob, 6, 6, DARK);
    px(-11, -17 + bob, 5, 4, MID);
    // Wing bone & translucent membrane highlight
    px(-12, -18 + bob, 5, 1, LIT);
    px(-10, -16 + bob, 3, 2, SPEC);
    px(-13, -20 + bob, 2, 2, OUTLINE);
    px(-12, -19 + bob, 1, 1, LIT);
  } else {
    px(-12, -14 + bob, 7, 7, OUTLINE);
    px(-11, -13 + bob, 5, 5, DARK);
    px(-10, -12 + bob, 4, 3, MID);
    px(-10, -12 + bob, 2, 1, LIT);
    px(-9, -11 + bob, 2, 1, SPEC);
  }

  // --- SHADED LEGS & CLAWS ---
  const leftLegY = pose === 'run' && walkCycle === 1 ? -4 : -3;
  const rightLegY = pose === 'run' && walkCycle === 3 ? -4 : -3;
  if (pose === 'jump' || pose === 'flutter' || pose === 'dash') {
    px(-5, -5, 4, 4, OUTLINE);
    px(-4, -4, 3, 2, MID);
    px(-3, -3, 2, 1, IVORY_MID);
    px(1, -6, 4, 4, OUTLINE);
    px(2, -5, 3, 2, MID);
    px(3, -4, 2, 1, IVORY_MID);
  } else {
    px(-5, leftLegY, 4, 3, OUTLINE);
    px(-4, leftLegY, 3, 2, MID);
    px(-3, leftLegY + 2, 3, 1, LIT);
    px(-2, leftLegY + 2, 1, 1, IVORY_MID);

    px(1, rightLegY, 4, 3, OUTLINE);
    px(2, rightLegY, 3, 2, MID);
    px(3, rightLegY + 2, 3, 1, LIT);
    px(4, rightLegY + 2, 1, 1, IVORY_MID);
  }

  // --- SCULPTED 16-BIT TORSO & LAYERED BELLY PLATES ---
  px(-6, -13 + bob, 12, 10, OUTLINE);
  px(-5, -12 + bob, 10, 8, DARK);
  px(-4, -12 + bob, 8, 7, MID);
  px(-4, -12 + bob, 2, 6, LIT); // key light rim
  px(-4, -12 + bob, 1, 4, SPEC);

  // Shaded horizontal dragon belly plates
  px(1, -11 + bob, 4, 7, BELLY_MID);
  px(2, -11 + bob, 2, 6, BELLY_HI);
  px(1, -10 + bob, 4, 1, BELLY_SHADE);
  px(1, -8 + bob, 4, 1, BELLY_SHADE);
  px(1, -6 + bob, 4, 1, BELLY_SHADE);

  // Shaded front arm + subtle spiked wristband (nod to Fierio reference!)
  px(3, -10 + bob, 4, 3, OUTLINE);
  px(3, -9 + bob, 3, 2, MID);
  px(4, -9 + bob, 1, 1, METAL_HI); // wristband stud
  px(5, -8 + bob, 2, 1, LIT);

  // --- EXPRESSIVE 16-BIT DRAGON HEAD & SNOUT ---
  px(-5, -20 + bob, 11, 9, OUTLINE);
  px(-4, -19 + bob, 9, 7, DARK);
  px(-3, -19 + bob, 7, 6, MID);
  px(-3, -19 + bob, 5, 2, LIT);

  // Rounded friendly snout with nostril & highlight
  px(4, -18 + bob, 6, 6, OUTLINE);
  px(4, -17 + bob, 5, 4, MID);
  px(5, -17 + bob, 3, 2, LIT);
  px(7, -17 + bob, 1, 1, SPEC); // snout gleam
  px(8, -16 + bob, 1, 1, OUTLINE); // nostril

  if (pose === 'surprise') {
    px(5, -14 + bob, 3, 2, RED_BRIGHT);
    px(6, -14 + bob, 1, 1, RED_TIP);
  } else {
    px(5, -14 + bob, 3, 1, IVORY_HI); // friendly dragon grin
    px(4, -14 + bob, 1, 1, IVORY_SHADE);
  }

  // Glossy 16-bit eye with bright catchlight & amber-gold lower iris
  px(1, -18 + bob, 3, 3, '#FFFFFF');
  px(2, -17 + bob, 2, 2, OUTLINE);
  px(2, -18 + bob, 1, 1, '#FFFFFF'); // catchlight sparkle
  px(3, -16 + bob, 1, 1, '#FACC15'); // subtle warm iris glint

  // --- 4-TONE BLAZING CRIMSON SPIKY MANE / CREST ---
  px(-8, -20 + bob, 5, 4, RED_DEEP);
  px(-9, -19 + bob, 4, 3, RED_MID);
  px(-9, -19 + bob, 2, 1, RED_BRIGHT);
  px(-7, -16 + bob, 4, 5, RED_DEEP);
  px(-8, -15 + bob, 3, 3, RED_MID);
  px(-8, -15 + bob, 1, 2, RED_BRIGHT);

  // Top blazing spikes
  px(-5, -23 + bob, 4, 4, RED_MID);
  px(-4, -24 + bob, 3, 3, RED_BRIGHT);
  px(-3, -25 + bob, 2, 2, RED_TIP);
  px(-1, -23 + bob, 3, 4, RED_BRIGHT);
  px(0, -24 + bob, 2, 2, RED_TIP);
  px(2, -22 + bob, 2, 2, RED_MID);

  // --- RIDGED CURVED IVORY HORNS ---
  px(-2, -24 + bob, 2, 5, IVORY_MID);
  px(-3, -25 + bob, 2, 2, IVORY_HI);
  px(-2, -22 + bob, 2, 1, IVORY_SHADE);
  px(-1, -20 + bob, 1, 1, IVORY_SHADE);

  px(3, -24 + bob, 2, 5, IVORY_MID);
  px(4, -25 + bob, 2, 2, IVORY_HI);
  px(3, -22 + bob, 2, 1, IVORY_SHADE);

  // --- SHADED SPIKED HEADPHONES ---
  px(-1, -21 + bob, 5, 2, METAL_DARK);
  px(0, -21 + bob, 3, 1, METAL_HI); // shiny headband top
  px(-3, -19 + bob, 4, 5, OUTLINE);
  px(-2, -18 + bob, 3, 3, METAL_MID);
  px(-1, -18 + bob, 1, 2, METAL_DARK);
  px(-3, -18 + bob, 1, 1, STUD); // silver spike stud
  px(-3, -16 + bob, 1, 1, STUD);
  px(-1, -17 + bob, 1, 1, RED_BRIGHT); // tiny headphone LED glow

  // --- VICTORY STAR-FIERIO GOLDEN CROWN ---
  if (hasStarCrown) {
    px(-3, -27 + bob, 8, 3, '#92400E');
    px(-2, -27 + bob, 6, 2, '#FACC15');
    px(-2, -28 + bob, 1, 1, '#FEF08A');
    px(0, -29 + bob, 2, 2, '#FEF08A');
    px(3, -28 + bob, 1, 1, '#FEF08A');
    px(0, -26 + bob, 2, 1, '#EF233C'); // ruby jewel
    px(0, -26 + bob, 1, 1, '#FF9AA7');
  }

  // --- EMBER DASH MULTI-TONE FLAME STREAM ---
  if (pose === 'dash') {
    px(-17, -15, 8, 2, '#FEF08A');
    px(-20, -11, 10, 3, '#F97316');
    px(-16, -7, 7, 2, RED_BRIGHT);
    px(-13, -11, 4, 2, '#FFFFFF');
  }

  ctx.restore();
}

export interface KittenDrawOpts {
  facing?: 1 | -1;
  frame?: number;
  happy?: boolean;
  sleeping?: boolean;
  waving?: boolean;
  surprised?: boolean;
  silhouette?: boolean;
  scale?: number;
  castShadow?: boolean;
}

/**
 * 16-Bit richly shaded sprite renderer for all 8 named kittens:
 * Angelica, Wizzle, D da Baller, Swipey, Ego, Mask, Loki, and Pitsy.
 */
export function drawKitten(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kitten: KittenInfo,
  opts: KittenDrawOpts = {}
): void {
  const {
    facing = 1,
    frame = 0,
    happy = false,
    sleeping = false,
    waving = false,
    surprised = false,
    silhouette = false,
    scale = 1,
    castShadow = false,
  } = opts;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  if (castShadow && !sleeping) {
    ctx.fillStyle = 'rgba(11, 14, 23, 0.3)';
    ctx.fillRect(-5 * scale, -1 * scale, 10 * scale, 2 * scale);
  }

  ctx.scale(facing * scale, scale);

  const px = (lx: number, ly: number, w: number, h: number, color: string) => {
    ctx.fillStyle = silhouette ? '#252D47' : color;
    ctx.fillRect(lx, ly, w, h);
  };

  const hop = happy ? -Math.abs(Math.round(Math.sin(frame * 0.35) * 4.5)) : 0;
  const tailWag = Math.floor(frame / 9) % 2;

  if (sleeping) {
    px(-7, -7, 14, 7, '#0B0E17');
    px(-6, -6, 12, 5, kitten.coatColor);
    px(-5, -6, 9, 2, kitten.bellyColor); // soft top sheen
    px(-5, -8, 2, 2, kitten.coatColor);
    px(0, -8, 2, 2, kitten.coatColor);
    px(2, -4, 3, 1, '#0B0E17');
    px(4, -3, 1, 1, '#FDA4AF');
    ctx.restore();
    return;
  }

  // Fluffy shaded wagging tail
  px(-8, -7 + hop - tailWag, 4, 3, '#0B0E17');
  px(-9, -9 + hop - tailWag, 3, 4, kitten.coatColor);
  px(-8, -9 + hop - tailWag, 1, 2, kitten.bellyColor);

  // Shaded Body + Highlight
  px(-6, -9 + hop, 12, 9, '#0B0E17');
  px(-5, -8 + hop, 10, 7, kitten.coatColor);
  px(-5, -3 + hop, 10, 2, kitten.stripeColor); // soft under-shading
  px(-1, -6 + hop, 5, 5, kitten.bellyColor);
  // Little paws with toes
  px(-4, -1 + hop, 3, 1, kitten.bellyColor);
  px(2, -1 + hop, 3, 1, kitten.bellyColor);

  // Shaded Head + Soft Cheek Fur
  px(-6, -15 + hop, 12, 8, '#0B0E17');
  px(-5, -14 + hop, 10, 6, kitten.coatColor);
  px(-4, -14 + hop, 7, 2, kitten.bellyColor); // soft top head highlight

  // Shaded Ears with pink inner glow
  px(-6, -18 + hop, 4, 4, '#0B0E17');
  px(-5, -17 + hop, 3, 3, kitten.coatColor);
  px(-4, -16 + hop, 1, 2, '#FDA4AF');
  px(2, -18 + hop, 4, 4, '#0B0E17');
  px(2, -17 + hop, 3, 3, kitten.coatColor);
  px(3, -16 + hop, 1, 2, '#FDA4AF');

  // Forehead & back stripes
  if (!silhouette) {
    px(-1, -14 + hop, 2, 2, kitten.stripeColor);
    px(-4, -7 + hop, 2, 1, kitten.stripeColor);
    px(-4, -5 + hop, 2, 1, kitten.stripeColor);
  }

  // Glossy 16-bit Face + Rosy Cheeks
  if (!silhouette) {
    px(-4, -10 + hop, 1, 1, '#FDA4AF'); // left rosy cheek
    px(4, -10 + hop, 1, 1, '#FDA4AF'); // right rosy cheek
    if (waving || surprised) {
      // Wide-eyed panicked/shouting kitten expression!
      px(-4, -13 + hop, 3, 3, '#FFFFFF');
      px(-3, -12 + hop, 2, 2, '#0B0E17');
      px(2, -13 + hop, 3, 3, '#FFFFFF');
      px(2, -12 + hop, 2, 2, '#0B0E17');
      // Big open shouting mouth ("MEOW!!" / "NOOOOO!")
      px(-1, -10 + hop, 3, 3, '#991B1B');
      px(0, -10 + hop, 2, 2, '#FB7185');
    } else if (happy) {
      px(-3, -12 + hop, 2, 1, '#0B0E17');
      px(2, -12 + hop, 2, 1, '#0B0E17');
      px(-1, -10 + hop, 3, 2, '#FB7185');
      px(0, -10 + hop, 1, 1, '#FFF1F2');
    } else {
      px(-3, -12 + hop, 2, 2, '#0B0E17');
      px(-3, -12 + hop, 1, 1, '#FFFFFF'); // eye glint!
      px(2, -12 + hop, 2, 2, '#0B0E17');
      px(2, -12 + hop, 1, 1, '#FFFFFF'); // eye glint!
      px(0, -10 + hop, 1, 1, '#FB7185');
    }
  }

  // Frantically waving arms raised high in the air!
  if (waving && !silhouette) {
    const wave = Math.floor(frame / 4) % 2;
    const leftArmY = wave === 0 ? -15 : -12;
    const rightArmY = wave === 0 ? -12 : -15;
    // Left raised paw
    px(-9, leftArmY + hop, 4, 4, '#0B0E17');
    px(-8, leftArmY + 1 + hop, 3, 2, kitten.coatColor);
    px(-8, leftArmY + 1 + hop, 2, 1, kitten.bellyColor);
    // Right raised paw
    px(5, rightArmY + hop, 4, 4, '#0B0E17');
    px(5, rightArmY + 1 + hop, 3, 2, kitten.coatColor);
    px(6, rightArmY + 1 + hop, 2, 1, kitten.bellyColor);
  }

  // Signature 16-bit Accessories per named kitten!
  if (!silhouette) {
    switch (kitten.accessory) {
      case 'halo_ribbon': // Angelica
        px(-4, -20 + hop, 8, 2, 'rgba(250, 204, 21, 0.35)');
        px(-3, -20 + hop, 6, 1, '#FACC15');
        px(-2, -20 + hop, 4, 1, '#FEF08A');
        px(-3, -8 + hop, 6, 1, '#FACC15');
        px(-1, -7 + hop, 2, 1, '#FEF08A');
        break;
      case 'wizard_hat': // Wizzle
        px(-6, -16 + hop, 12, 2, '#5B21B6');
        px(-5, -16 + hop, 10, 1, '#8B5CF6');
        px(-4, -19 + hop, 8, 3, '#6D28D9');
        px(-2, -22 + hop, 5, 3, '#7C3AED');
        px(-1, -23 + hop, 2, 1, '#A78BFA');
        px(0, -19 + hop, 1, 2, '#FACC15');
        px(-1, -18 + hop, 3, 1, '#FEF08A');
        break;
      case 'headband': // D da Baller
        px(-5, -14 + hop, 10, 2, '#B91C1C');
        px(-5, -14 + hop, 10, 1, '#EF233C');
        px(-1, -14 + hop, 3, 1, '#FFFFFF');
        // Shaded 16-bit basketball
        px(6, -6 + hop, 5, 5, '#7C2D12');
        px(7, -5 + hop, 3, 3, '#F97316');
        px(7, -5 + hop, 2, 1, '#FDBA74');
        px(8, -5 + hop, 1, 3, '#7C2D12');
        break;
      case 'scarf': // Swipey
        px(-5, -8 + hop, 10, 2, '#0891B2');
        px(-4, -8 + hop, 8, 1, '#22D3EE');
        px(-7, -7 + hop - tailWag, 4, 3, '#06B6D4');
        px(-7, -6 + hop - tailWag, 3, 1, '#FACC15');
        break;
      case 'shades_bow': // Ego
        px(-5, -13 + hop, 4, 2, '#0F172A');
        px(1, -13 + hop, 4, 2, '#0F172A');
        px(-1, -13 + hop, 2, 1, '#334155');
        px(-4, -13 + hop, 1, 1, '#E2E8F0'); // glossy sheen
        px(2, -13 + hop, 1, 1, '#E2E8F0');
        px(-2, -8 + hop, 5, 2, '#DC2626');
        px(0, -8 + hop, 1, 2, '#FF9AA7');
        break;
      case 'eye_mask': // Mask
        px(-5, -13 + hop, 10, 2, '#991B1B');
        px(-5, -13 + hop, 10, 1, '#EF233C');
        px(-3, -12 + hop, 2, 1, '#FFFFFF');
        px(2, -12 + hop, 2, 1, '#FFFFFF');
        break;
      case 'trickster_tuft': // Loki
        px(-1, -17 + hop, 3, 2, '#059669');
        px(0, -18 + hop, 1, 2, '#34D399');
        px(-4, -8 + hop, 8, 2, '#10B981');
        px(0, -7 + hop, 2, 2, '#FACC15');
        break;
      case 'leaf_crown': // Pitsy holding the autumn maple leaf!
        px(-3, -18 + hop, 6, 2, '#D97706');
        px(-2, -19 + hop, 4, 2, '#FACC15');
        px(-1, -20 + hop, 2, 1, '#FEF08A');
        if (kitten.holdsLeaf) {
          drawMapleLeaf(ctx, 9, -9 + hop, frame * 0.12, 0.85);
        }
        break;
    }
  }

  ctx.restore();
}

/**
 * 16-Bit multi-tone autumn crimson-orange Maple Leaf with 5-lobed silhouette,
 * golden vein highlights, woody stem, and optional scale/rotation for close-up camera swoops.
 */
export function drawMapleLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  scale = 1,
  rotation?: number
): void {
  const swayY = scale <= 2 ? Math.sin(time * 2.5) * 1.6 : 0;
  const rot = rotation !== undefined ? rotation : Math.sin(time * 2.1) * 0.24;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + swayY));
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  // Soft warm autumn shimmer aura
  ctx.fillStyle = 'rgba(249, 115, 22, 0.26)';
  ctx.fillRect(-7, -7, 14, 13);

  // Dark pixel outline of classic 5-lobed maple leaf
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(-2, -7, 4, 3); // top lobe tip
  ctx.fillRect(-4, -5, 8, 3); // upper crown
  ctx.fillRect(-7, -3, 14, 4); // wide left & right lobes
  ctx.fillRect(-6, 1, 12, 3); // lower lobes
  ctx.fillRect(-3, 3, 6, 2); // leaf base

  // Deep crimson base fill
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(-1, -6, 2, 2);
  ctx.fillRect(-3, -4, 6, 3);
  ctx.fillRect(-6, -2, 12, 3);
  ctx.fillRect(-5, 1, 10, 2);
  ctx.fillRect(-2, 3, 4, 1);

  // Vibrant vermilion-red midtone
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-1, -5, 2, 2);
  ctx.fillRect(-3, -3, 6, 3);
  ctx.fillRect(-5, -2, 10, 2);
  ctx.fillRect(-4, 0, 8, 2);

  // Fiery autumn orange & golden inner veins
  ctx.fillStyle = '#F97316';
  ctx.fillRect(-1, -4, 2, 6);
  ctx.fillRect(-4, -1, 8, 1);
  ctx.fillRect(-3, 1, 6, 1);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, -3, 1, 5);
  ctx.fillRect(-2, -1, 4, 1);

  // Crisp woody maple stem
  ctx.fillStyle = '#451A03';
  ctx.fillRect(-1, 4, 2, 4);
  ctx.fillStyle = '#92400E';
  ctx.fillRect(0, 4, 1, 3);

  ctx.restore();
}

export function drawTreat(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.round(Math.sin(time * 4 + x * 0.08) * 1.5);
  const cx = Math.round(x);
  const cy = Math.round(y + bob);
  // Subtle sparkle gleam
  if (Math.floor(time * 6 + x) % 4 === 0) {
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(cx - 6, cy - 5, 1, 3);
    ctx.fillRect(cx - 7, cy - 4, 3, 1);
  }
  // 16-bit shaded golden fish treat
  ctx.fillStyle = '#451A03';
  ctx.fillRect(cx - 6, cy - 4, 11, 8);
  ctx.fillStyle = '#D97706';
  ctx.fillRect(cx - 5, cy - 3, 7, 6);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(cx - 4, cy - 3, 6, 4);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(cx - 3, cy - 2, 4, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cx - 2, cy - 2, 2, 1);
  // Shaded tail fin
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cx + 2, cy - 3, 3, 6);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(cx + 3, cy - 2, 2, 4);
  ctx.fillStyle = '#0F1320';
  ctx.fillRect(cx - 4, cy - 1, 1, 1);
}

/**
 * 16-Bit shaded metallic can of cat food that restores +1 Heart when Fierio picks it up!
 */
export function drawCatFoodCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  needsHeal = true
): void {
  const bob = Math.round(Math.sin(time * 3.5 + x * 0.06) * 1.5);
  const cx = Math.round(x);
  const cy = Math.round(y + bob);

  // Soft healing glow behind can when player can heal
  if (needsHeal) {
    const pulse = Math.floor(time * 5) % 2;
    ctx.fillStyle = 'rgba(251, 113, 133, 0.22)';
    ctx.fillRect(cx - 8 - pulse, cy - 8 - pulse, 16 + pulse * 2, 16 + pulse * 2);
  }

  // Pull-tab ring on top of tin
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(cx - 1, cy - 9, 4, 3);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(cx, cy - 8, 2, 2);

  // Outer dark pixel outline of cylindrical tin
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(cx - 7, cy - 7, 14, 14);

  // Top & bottom metallic silver rims
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(cx - 6, cy - 6, 12, 3);
  ctx.fillRect(cx - 6, cy + 4, 12, 2);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cx - 5, cy - 6, 8, 1);
  ctx.fillRect(cx - 5, cy + 4, 6, 1);
  ctx.fillStyle = '#64748B';
  ctx.fillRect(cx + 3, cy - 5, 3, 2);
  ctx.fillRect(cx + 3, cy + 4, 3, 2);

  // Vibrant crimson & cream cat-food label wrap
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(cx - 6, cy - 3, 12, 7);
  ctx.fillStyle = '#EF233C';
  ctx.fillRect(cx - 6, cy - 3, 9, 7);
  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(cx - 5, cy - 2, 10, 5);
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(cx + 2, cy - 2, 3, 5);

  // Mini fish + heart emblem on the cat food label
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cx - 4, cy - 1, 4, 3);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(cx - 3, cy - 1, 2, 2);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cx, cy, 1, 1);

  // Tiny ruby health heart on right side of label
  ctx.fillStyle = '#EF233C';
  ctx.fillRect(cx + 1, cy - 1, 1, 1);
  ctx.fillRect(cx + 3, cy - 1, 1, 1);
  ctx.fillRect(cx + 1, cy, 3, 1);
  ctx.fillRect(cx + 2, cy + 1, 1, 1);

  // Rising sparkle glint above can
  if (Math.floor(time * 5 + x) % 3 === 0) {
    ctx.fillStyle = '#86EFAC';
    ctx.fillRect(cx + 6, cy - 9, 1, 3);
    ctx.fillRect(cx + 5, cy - 8, 3, 1);
  }
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: EnemyKind,
  frame: number,
  facing: 1 | -1
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  // Contact shadow
  ctx.fillStyle = 'rgba(11, 14, 23, 0.32)';
  ctx.fillRect(-6, -1, 12, 2);

  ctx.scale(facing, 1);
  const step = Math.floor(frame / 6) % 2;

  if (kind === 'mouse') {
    // 16-bit metallic wind-up toy mouse
    ctx.fillStyle = '#0B0E17';
    ctx.fillRect(-8, -10, 16, 10);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7, -9, 14, 8);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-6, -9, 12, 5);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-4, -8, 8, 2); // metallic sheen
    // Shaded ear & ruby nose
    ctx.fillStyle = '#BE185D';
    ctx.fillRect(1, -12, 4, 4);
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(2, -11, 2, 2);
    ctx.fillStyle = '#EF233C';
    ctx.fillRect(7, -6, 2, 2);
    // Brass wind-up key
    ctx.fillStyle = '#B45309';
    ctx.fillRect(-4, -14 - step, 4, 5);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-6, -14 - step, 8, 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-5, -14 - step, 4, 1);
    // Wheels
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5 + step, -2, 3, 2);
    ctx.fillRect(2 - step, -2, 3, 2);
  } else if (kind === 'yarn') {
    // 16-bit woven grumpy yarn ball
    const rot = Math.floor(frame / 5) % 2;
    ctx.fillStyle = '#0B0E17';
    ctx.fillRect(-8, -14, 16, 14);
    ctx.fillStyle = '#9D174D';
    ctx.fillRect(-7, -13, 14, 12);
    ctx.fillStyle = '#EC4899';
    ctx.fillRect(-6, -13, 12, 9);
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(-5 + rot, -12, 10, 2);
    ctx.fillRect(-5, -8 + rot, 10, 2);
    ctx.fillStyle = '#FBCFE8';
    ctx.fillRect(-4 + rot, -12, 5, 1);
    // Expressive grumpy eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, -10, 3, 3);
    ctx.fillRect(4, -10, 3, 3);
    ctx.fillStyle = '#0B0E17';
    ctx.fillRect(1, -9, 2, 2);
    ctx.fillRect(5, -9, 2, 2);
    ctx.fillRect(0, -11, 3, 1);
    ctx.fillRect(4, -11, 3, 1);
  } else if (kind === 'spark') {
    // 16-bit glowing ember sprite with warm bloom
    const flick = Math.floor(frame / 4) % 2;
    ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
    ctx.fillRect(-9, -16 - flick, 18, 16 + flick);
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(-7, -13 - flick, 14, 13 + flick);
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(-6, -12 - flick, 12, 11);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-4, -9, 8, 7);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-2, -7, 4, 4);
    ctx.fillStyle = '#0B0E17';
    ctx.fillRect(-2, -8, 1, 2);
    ctx.fillRect(2, -8, 1, 2);
  } else {
    // 16-bit beveled marching board-game die
    ctx.fillStyle = '#0B0E17';
    ctx.fillRect(-8, -15, 16, 14);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-7, -14, 14, 12);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-7, -14, 12, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-6, -13, 10, 2);
    // Engraved pips
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5, -12, 2, 2);
    ctx.fillRect(2, -12, 2, 2);
    ctx.fillRect(-1, -9, 2, 2);
    ctx.fillRect(-5, -6, 2, 2);
    ctx.fillRect(2, -6, 2, 2);
    // Marching red boots
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(-5, -2 - step, 4, 2);
    ctx.fillRect(1, -2 + step, 4, 2);
    ctx.fillStyle = '#EF233C';
    ctx.fillRect(-4, -2 - step, 2, 1);
    ctx.fillRect(2, -2 + step, 2, 1);
  }

  ctx.restore();
}

export function drawPadlock(ctx: CanvasRenderingContext2D, x: number, y: number, shakeX = 0): void {
  const cx = Math.round(x + shakeX);
  const cy = Math.round(y);
  // Sculpted 16-bit iron & steel padlock
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(cx - 5, cy - 12, 10, 7);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(cx - 4, cy - 11, 8, 6);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(cx - 3, cy - 11, 3, 2);
  ctx.fillStyle = '#1E253B';
  ctx.fillRect(cx - 2, cy - 9, 4, 4);

  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(cx - 7, cy - 6, 14, 10);
  ctx.fillStyle = '#64748B';
  ctx.fillRect(cx - 6, cy - 5, 12, 8);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(cx - 6, cy - 5, 10, 5);
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(cx - 5, cy - 4, 8, 2);
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(cx - 1, cy - 3, 2, 4);
}

export function drawMapLandmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'meadow' | 'rooftop' | 'fern' | 'cushion' | 'domino' | 'cavern' | 'attic' | 'castle',
  unlocked: boolean,
  time: number
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (!unlocked) {
    ctx.globalAlpha = 0.56;
  }

  // Ground shadow under every 16-bit landmark
  ctx.fillStyle = 'rgba(11, 14, 23, 0.28)';
  ctx.fillRect(-16, -4, 32, 4);

  switch (type) {
    case 'meadow':
      // Shaded 16-bit oak tree
      ctx.fillStyle = '#451A03';
      ctx.fillRect(-15, -13, 5, 10);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-14, -13, 3, 9);
      ctx.fillStyle = '#14532D';
      ctx.fillRect(-20, -21, 15, 10);
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(-19, -22, 13, 9);
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(-17, -21, 8, 4);
      ctx.fillStyle = '#BBF7D0';
      ctx.fillRect(-16, -21, 4, 2);
      // Shaded starter cottage
      ctx.fillStyle = '#78350F';
      ctx.fillRect(4, -14, 15, 11);
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(5, -13, 13, 9);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(14, -13, 4, 9); // side shade
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(3, -18, 17, 6);
      ctx.fillStyle = '#EF233C';
      ctx.fillRect(4, -18, 14, 4);
      ctx.fillStyle = '#FF758F';
      ctx.fillRect(5, -18, 10, 1);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(9, -9, 4, 5);
      break;

    case 'rooftop':
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-12, -17, 24, 13);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-11, -16, 22, 11);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-11, -16, 15, 10);
      // Shingled pitched roof
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(-14, -21, 28, 6);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-13, -21, 25, 4);
      ctx.fillStyle = '#F87171';
      ctx.fillRect(-12, -21, 22, 1);
      // Glowing sunlit windowpane
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-6, -14, 12, 7);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-5, -13, 10, 5);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, -14, 1, 7);
      ctx.fillRect(-6, -11, 12, 1);
      break;

    case 'fern':
      // Glazed terracotta pot + layered fronds
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(-9, -11, 18, 8);
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(-8, -11, 15, 7);
      ctx.fillStyle = '#FB923C';
      ctx.fillRect(-10, -13, 20, 3);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(-9, -13, 12, 1);
      // Lush multi-shade fern canopy
      ctx.fillStyle = '#14532D';
      ctx.fillRect(-13, -22, 9, 10);
      ctx.fillRect(4, -22, 9, 10);
      ctx.fillStyle = '#15803D';
      ctx.fillRect(-11, -23, 8, 10);
      ctx.fillRect(3, -23, 8, 10);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-6, -26, 12, 13);
      ctx.fillStyle = '#86EFAC';
      ctx.fillRect(-4, -25, 6, 4);
      break;

    case 'cushion':
      // Quilted 16-bit pillow fort
      ctx.fillStyle = '#4C1D95';
      ctx.fillRect(-14, -12, 28, 9);
      ctx.fillStyle = '#7C3AED';
      ctx.fillRect(-13, -11, 26, 7);
      ctx.fillStyle = '#A78BFA';
      ctx.fillRect(-11, -11, 20, 3);
      ctx.fillStyle = '#9D174D';
      ctx.fillRect(-10, -19, 20, 8);
      ctx.fillStyle = '#EC4899';
      ctx.fillRect(-9, -18, 18, 6);
      ctx.fillStyle = '#F9A8D4';
      ctx.fillRect(-8, -18, 14, 2);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-2, -16, 4, 3);
      break;

    case 'domino':
      ctx.fillStyle = '#334155';
      ctx.fillRect(-15, -16, 30, 12);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-14, -15, 28, 10);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-14, -15, 26, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-13, -15, 24, 2);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-1, -15, 2, 10);
      ctx.fillRect(-10, -12, 2, 2);
      ctx.fillRect(-5, -8, 2, 2);
      ctx.fillRect(5, -12, 2, 2);
      ctx.fillRect(10, -8, 2, 2);
      break;

    case 'cavern':
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-14, -19, 28, 16);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-13, -18, 26, 14);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-12, -18, 18, 4);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-8, -14, 16, 11);
      // Warm animated lava glow inside arch
      ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
      ctx.fillRect(-8, -13, 16, 10);
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(-6, -9, 12, 6);
      ctx.fillStyle = Math.sin(time * 6) > 0 ? '#FACC15' : '#F97316';
      ctx.fillRect(-4, -8, 8, 4);
      break;

    case 'attic':
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-10, -23, 20, 20);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-9, -22, 18, 18);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-9, -22, 10, 17);
      // Steep indigo spire roof
      ctx.fillStyle = '#312E81';
      ctx.fillRect(-12, -27, 24, 6);
      ctx.fillStyle = '#6366F1';
      ctx.fillRect(-10, -28, 20, 4);
      ctx.fillStyle = '#A5B4FC';
      ctx.fillRect(-6, -29, 12, 2);
      // Warm moonlit window
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-4, -18, 8, 8);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-3, -17, 6, 6);
      // Twinkling stars
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(11, -25, 2, 2);
      ctx.fillRect(-13, -21, 2, 2);
      break;

    case 'castle':
      // Grand 16-bit Board Game Castle
      ctx.fillStyle = '#475569';
      ctx.fillRect(-17, -21, 34, 18);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-16, -20, 32, 16);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-16, -20, 22, 14);
      // Side towers
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-19, -27, 9, 24);
      ctx.fillRect(10, -27, 9, 24);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-18, -26, 6, 22);
      ctx.fillRect(11, -26, 6, 22);
      // Central royal keep
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-6, -30, 12, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-5, -29, 9, 10);
      // Animated crimson banners
      const flap = Math.floor(time * 6) % 2;
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(-15, -32, 7 + flap, 4);
      ctx.fillRect(13, -32, 7 - flap, 4);
      ctx.fillRect(-2, -35, 8 + flap, 5);
      ctx.fillStyle = '#EF233C';
      ctx.fillRect(-15, -32, 6 + flap, 3);
      ctx.fillRect(13, -32, 6 - flap, 3);
      ctx.fillRect(-2, -35, 7 + flap, 4);
      // Royal arch gate
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-5, -13, 10, 9);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-5, -14, 10, 1);
      break;
  }
  ctx.restore();
}

export function getAbilityEmojiFallback(id: AbilityId): string {
  switch (id) {
    case 'wing_flutter': return 'WF';
    case 'fire_puff': return 'FP';
    case 'tail_bounce': return 'TB';
    case 'ember_dash': return 'ED';
    case 'flame_shield': return 'FS';
    case 'wall_kick': return 'WK';
    case 'double_flap': return 'DF';
    case 'star_crown': return 'SC';
  }
}
