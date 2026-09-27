import * as React from "react";

// A sprite is a grid of palette keys; "." (or space) is transparent.
export type Sprite = {
  rows: string[];
  palette: Record<string, string>;
};

type SpritePath = { key: string; d: string };

const pathCache = new WeakMap<Sprite, SpritePath[]>();

// Merge horizontal runs of the same colour into a single SVG path per colour,
// which keeps the DOM small (one <path> per palette entry).
function getSpritePaths(sprite: Sprite): SpritePath[] {
  const cached = pathCache.get(sprite);
  if (cached) {
    return cached;
  }
  const byKey: Record<string, string> = {};
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      if (key === "." || key === " ") {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < row.length && row[x + len] === key) {
        len++;
      }
      byKey[key] = (byKey[key] || "") + `M${x} ${y}h${len}v1h-${len}z`;
      x += len;
    }
  });
  const paths = Object.keys(byKey).map((key) => ({ key, d: byKey[key] }));
  pathCache.set(sprite, paths);
  return paths;
}

export function getSpriteSize(sprite: Sprite): { w: number; h: number } {
  let w = 0;
  sprite.rows.forEach((row) => {
    w = Math.max(w, row.length);
  });
  return { w, h: sprite.rows.length };
}

// Encodes a sprite as an SVG data URI (eg. for tiled CSS backgrounds).
export function spriteToDataUri(sprite: Sprite, px = 1): string {
  const { w, h } = getSpriteSize(sprite);
  const paths = getSpritePaths(sprite)
    .map(({ key, d }) => `<path d="${d}" fill="${sprite.palette[key]}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * px}" height="${
    h * px
  }" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const PixelSprite: React.FC<{
  sprite: Sprite;
  // CSS pixels per art pixel (ignored when `height` is set).
  px?: number;
  // Any CSS length (e.g. "1.4em"); width follows the sprite's aspect ratio.
  height?: string;
  colors?: Record<string, string | undefined>;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}> = ({ sprite, px = 2, height, colors, className, style, title }) => {
  const { w, h } = getSpriteSize(sprite);
  const sizeStyle: React.CSSProperties = height
    ? { height, width: `calc(${height} * ${w / h})` }
    : { width: w * px, height: h * px };
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "inline-block", flexShrink: 0, ...sizeStyle, ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {getSpritePaths(sprite).map(({ key, d }) => {
        const fill = (colors && colors[key]) || sprite.palette[key];
        return fill && fill.indexOf("var(") === 0 ? (
          <path key={key} d={d} style={{ fill }} />
        ) : (
          <path key={key} d={d} fill={fill} />
        );
      })}
    </svg>
  );
};

export default PixelSprite;
