export type Rng = () => number;

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, values: T[]): T {
  return values[Math.floor(rng() * values.length)];
}

export function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(between(rng, min, max + 1));
}

export function code(rng: Rng, pattern: string): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return pattern.replace(/[A#]/g, (token) => {
    if (token === "A") return letters[int(rng, 0, letters.length - 1)];
    return String(int(rng, 0, 9));
  });
}
