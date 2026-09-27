import * as React from "react";

import { CardType, ResourceType, Season } from "../../model/types";
import PixelSprite, { Sprite } from "./PixelSprite";
import * as S from "./sprites";
import { PlayerTheme } from "../gameUI";

export const RESOURCE_SPRITES: Record<string, Sprite> = {
  [ResourceType.TWIG]: S.TWIG,
  [ResourceType.RESIN]: S.RESIN,
  [ResourceType.PEBBLE]: S.PEBBLE,
  [ResourceType.BERRY]: S.BERRY,
  [ResourceType.PEARL]: S.PEARL,
  [ResourceType.VP]: S.VP,
  ANY: S.ANY,
  CARD: S.CARD,
  GOLDEN_LEAF: S.GOLDEN_LEAF,
  TRAIN_TICKET: S.TICKET,
  RESERVATION_TOKEN: S.RESERVATION_TOKEN,
};

export const CARD_TYPE_SPRITES: Record<CardType, Sprite> = {
  [CardType.TRAVELER]: S.BADGE_TRAVELER,
  [CardType.PRODUCTION]: S.BADGE_PRODUCTION,
  [CardType.DESTINATION]: S.BADGE_DESTINATION,
  [CardType.GOVERNANCE]: S.BADGE_GOVERNANCE,
  [CardType.PROSPERITY]: S.BADGE_PROSPERITY,
};

export const SEASON_SPRITES: Record<Season, Sprite> = {
  [Season.WINTER]: S.SNOWFLAKE,
  [Season.SPRING]: S.BLOSSOM,
  [Season.SUMMER]: S.SUN,
  [Season.AUTUMN]: S.AUTUMN_LEAF,
};

const FILL: React.CSSProperties = { width: "100%", height: "100%" };

// Icon that stretches to its (sized) parent, like the old next/image "fill".
export const FillSprite: React.FC<{
  sprite: Sprite;
  colors?: Record<string, string | undefined>;
  title?: string;
}> = ({ sprite, colors, title }) => (
  <PixelSprite sprite={sprite} colors={colors} style={FILL} title={title} />
);

export const Meeple: React.FC<{
  theme: PlayerTheme;
  height?: string;
  ghost?: boolean;
  frog?: boolean;
  className?: string;
  title?: string;
}> = ({
  theme,
  height = "1.6em",
  ghost = false,
  frog = false,
  className,
  title,
}) => (
  <PixelSprite
    sprite={frog ? S.FROG_MEEPLE : S.MEEPLE}
    height={height}
    className={className}
    title={title}
    style={ghost ? { opacity: 0.35, filter: "grayscale(0.6)" } : undefined}
    colors={{ C: theme.color, D: theme.dark, L: theme.light }}
  />
);

export const CritterAvatar: React.FC<{
  theme: PlayerTheme;
  height?: string;
  className?: string;
}> = ({ theme, height = "2.5em", className }) => (
  <PixelSprite
    sprite={S.CRITTERS[theme.critter]}
    height={height}
    className={className}
  />
);
