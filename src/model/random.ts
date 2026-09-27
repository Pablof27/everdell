// Single source of randomness for the engine so simulations can be seeded.

export type Rng = () => number;

// mulberry32: small, fast, good enough for shuffling.
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let currentRng: Rng = Math.random;

export function setRng(rng: Rng | null): void {
  currentRng = rng || Math.random;
}

export function seedRng(seed: number): void {
  setRng(createSeededRng(seed));
}

export function random(): number {
  return currentRng();
}

export function randomInt(maxExclusive: number, rng: Rng = currentRng): number {
  return Math.floor(rng() * maxExclusive);
}

export function sample<T>(items: readonly T[], rng: Rng = currentRng): T {
  if (items.length === 0) {
    throw new Error("Cannot sample from an empty list");
  }
  return items[randomInt(items.length, rng)];
}

// Fisher-Yates on a copy (same contract as lodash/shuffle).
export function shuffle<T>(items: readonly T[], rng: Rng = currentRng): T[] {
  const ret = items.slice();
  for (let i = ret.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = ret[i];
    ret[i] = ret[j];
    ret[j] = tmp;
  }
  return ret;
}

// Runs fn with rng as the engine RNG, restoring the previous one afterwards.
export function withRng<T>(rng: Rng, fn: () => T): T {
  const prev = currentRng;
  currentRng = rng;
  try {
    return fn();
  } finally {
    currentRng = prev;
  }
}
