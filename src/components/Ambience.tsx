import * as React from "react";

import styles from "../styles/Ambience.module.css";
import anim from "../styles/animations.module.css";
import { Season } from "../model/types";
import PixelSprite, { Sprite } from "./pixel/PixelSprite";
import * as Sprites from "./pixel/sprites";

// Deterministic integer hash so server and client render the same markup.
const rand = (seed: number): number => {
  let t = (seed * 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PARTICLES: Record<Season, Sprite> = {
  [Season.WINTER]: Sprites.SNOW,
  [Season.SPRING]: Sprites.PETAL,
  [Season.SUMMER]: Sprites.FIREFLY,
  [Season.AUTUMN]: Sprites.AUTUMN_LEAF,
};

export const SeasonParticles: React.FC<{ season: Season; count?: number }> = ({
  season,
  count = 14,
}) => {
  const isFirefly = season === Season.SUMMER;
  return (
    <div className={styles.particles} aria-hidden={true}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = rand(i * 3 + 1);
        const r2 = rand(i * 3 + 2);
        const r3 = rand(i * 3 + 3);
        return (
          <span
            key={`${season}-${i}`}
            className={isFirefly ? styles.firefly : styles.particle}
            style={{
              left: `${Math.round(r1 * 100)}%`,
              top: isFirefly ? `${Math.round(15 + r3 * 70)}%` : undefined,
              animationDelay: `${-(r2 * 24).toFixed(2)}s`,
              animationDuration: `${(isFirefly ? 5 : 16) + r3 * 12}s`,
              ["--drift" as any]: `${Math.round((r2 - 0.5) * 160)}px`,
            }}
          >
            <PixelSprite
              sprite={PARTICLES[season]}
              px={season === Season.AUTUMN ? 1.5 : 2}
            />
          </span>
        );
      })}
    </div>
  );
};

type SceneryItem = {
  sprite: Sprite;
  px: number;
  style: React.CSSProperties;
  sway?: boolean;
};

const SCENERY: SceneryItem[] = [
  { sprite: Sprites.TREE, px: 4, style: { left: -30, top: 520 }, sway: true },
  { sprite: Sprites.MUSHROOM, px: 3, style: { left: 34, top: 600 } },
  { sprite: Sprites.BUSH, px: 3, style: { left: -6, top: 690 } },
  { sprite: Sprites.PINE, px: 4, style: { left: -18, top: 760 }, sway: true },
  { sprite: Sprites.FLOWER, px: 3, style: { left: 60, top: 720 } },
  { sprite: Sprites.TREE, px: 4, style: { right: -30, top: 560 }, sway: true },
  { sprite: Sprites.STUMP, px: 3, style: { right: 2, top: 690 } },
  { sprite: Sprites.ROCK, px: 3, style: { right: 56, top: 720 } },
  { sprite: Sprites.FLOWER, px: 3, style: { right: 30, top: 650 } },
  { sprite: Sprites.BUSH, px: 3, style: { right: -10, top: 800 } },
];

// Decorative trees & shrubs peeking out from behind the board sections.
export const BoardScenery: React.FC = () => {
  return (
    <div className={styles.scenery} aria-hidden={true}>
      {SCENERY.map((item, idx) => (
        <span
          key={idx}
          className={[styles.scenery_item, item.sway && anim.sway]
            .filter(Boolean)
            .join(" ")}
          style={{
            ...item.style,
            animationDelay: item.sway ? `${-idx * 0.7}s` : undefined,
          }}
        >
          <PixelSprite sprite={item.sprite} px={item.px} />
        </span>
      ))}
    </div>
  );
};
