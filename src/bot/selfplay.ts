// Self-play games and their training records (one per decision): the encoded
// position seen by the player to move, its legal action keys, the improved
// policy (root visit fractions by key) and, once the game is over, the outcome
// z and the final VP margin for that player.
import cloneDeep from "lodash/cloneDeep";
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { GameInput, GameOptions } from "../model/types";
import { Rng, createSeededRng, withRng } from "../model/random";
import { getLegalMoves } from "./legalMoves";
import { ACTION_KEYS, ACTION_KEY_INDEX, vocabularyKey } from "./actionKey";
import {
  encodeStateRaw,
  featureNames,
  featureScales,
  stateDim,
} from "./encodeState";
import { MctsBot, pickMove } from "./mctsBot";
import { GreedyBot } from "./greedyBot";
import { SEARCH_MAX_PER_INPUT, terminalValues } from "./everdellGame";

export type PositionRecord = {
  raw: Uint8Array;
  seat: number;
  // Vocabulary indices of the legal keyed moves (unique).
  legalKeys: number[];
  // Key index -> probability, summing to 1; null when there is no policy
  // target (set-valued decisions, single legal move, reduced searches).
  policy: Map<number, number> | null;
  // The search's value of the position for `seat` (NaN without a search).
  rootValue: number;
};

export type GameRecord = {
  seed: number;
  points: number[];
  numMoves: number;
  positions: PositionRecord[];
};

export type Decision = {
  moveIdx: number;
  // Probability of each legal move (aligned with legalMoves), or null.
  policy: number[] | null;
  rootValue: number;
};

// Chooses the moves of every seat and provides the policy targets.
export interface SelfPlayer {
  decide(
    gameState: GameState,
    legalMoves: GameInput[],
    decisionIdx: number
  ): Decision;
}

export type MctsSelfPlayOptions = {
  simulations: number;
  determinizations?: number;
  // Root noise; 0 disables it.
  dirichletAlpha?: number;
  dirichletEpsilon?: number;
  // Moves sampled with temperature 1 for the first decisions of the game,
  // then the most visited move.
  temperatureDecisions?: number;
  // Playout cap randomization: only this fraction of the decisions gets a
  // full search (and a policy target), the others `fastSimulations`.
  fullSearchProb?: number;
  fastSimulations?: number;
};

export class MctsSelfPlayer implements SelfPlayer {
  private readonly bot: MctsBot;
  private readonly rng: Rng;
  private readonly opts: Required<MctsSelfPlayOptions>;

  constructor(bot: MctsBot, rng: Rng, opts: MctsSelfPlayOptions) {
    this.bot = bot;
    this.rng = rng;
    this.opts = {
      determinizations: 1,
      dirichletAlpha: 1,
      dirichletEpsilon: 0.25,
      temperatureDecisions: 30,
      fullSearchProb: 1,
      fastSimulations: Math.max(1, Math.round(opts.simulations / 4)),
      ...opts,
    };
  }

  decide(
    gameState: GameState,
    legalMoves: GameInput[],
    decisionIdx: number
  ): Decision {
    const o = this.opts;
    const full = o.fullSearchProb >= 1 || this.rng() < o.fullSearchProb;
    const search = this.bot.search(gameState, legalMoves, {
      simulations: full ? o.simulations : o.fastSimulations,
      determinizations: o.determinizations,
      dirichletAlpha:
        full && o.dirichletAlpha > 0 ? o.dirichletAlpha : undefined,
      dirichletEpsilon: o.dirichletEpsilon,
    });
    const temperature = decisionIdx < o.temperatureDecisions ? 1 : 0;
    const total = search.visits.reduce((a, b) => a + b, 0);
    return {
      moveIdx: pickMove(search, temperature, this.rng),
      policy: full && total > 0 ? search.visits.map((n) => n / total) : null,
      rootValue: search.rootValue[search.player],
    };
  }
}

// Warm start: the greedy bot's moves, with a one-hot policy target or (with a
// temperature, in evaluation units) a softmax over the moves' 1-ply scores.
export class GreedySelfPlayer implements SelfPlayer {
  private readonly bot: GreedyBot;
  private readonly temperature: number;

  constructor(bot: GreedyBot, temperature = 0) {
    this.bot = bot;
    this.temperature = temperature;
  }

  decide(gameState: GameState, legalMoves: GameInput[]): Decision {
    const scores = this.bot.scoreMoves(gameState, legalMoves);
    let best = 0;
    scores.forEach((s, i) => {
      if (s !== null && (scores[best] === null || s > scores[best]!)) {
        best = i;
      }
    });
    let policy: number[];
    if (this.temperature > 0 && scores[best] !== null) {
      const top = scores[best]!;
      const exps = scores.map((s) =>
        s === null ? 0 : Math.exp((s - top) / this.temperature)
      );
      const total = exps.reduce((a, b) => a + b, 0);
      policy = exps.map((e) => e / total);
    } else {
      policy = legalMoves.map((_, i) => (i === best ? 1 : 0));
    }
    return { moveIdx: best, policy, rootValue: NaN };
  }
}

// Probability mass of the keyed moves, aggregated by key and renormalized;
// null when no move is keyed.
function policyByKey(
  keys: (string | null)[],
  probs: number[]
): Map<number, number> | null {
  const byKey = new Map<number, number>();
  let total = 0;
  keys.forEach((key, i) => {
    if (key !== null) {
      const k = ACTION_KEY_INDEX.get(key)!;
      byKey.set(k, (byKey.get(k) || 0) + probs[i]);
      total += probs[i];
    }
  });
  if (!(total > 0)) {
    return null;
  }
  byKey.forEach((p, k) => byKey.set(k, p / total));
  return byKey;
}

/**
 * Plays one game where `player` chooses every move. All engine randomness is
 * driven by `seed` (as in arena.ts), the player's by its own rng.
 */
export function playSelfPlayGame({
  player,
  seed,
  numPlayers = 2,
  gameOptions = {},
  maxPerInput = SEARCH_MAX_PER_INPUT,
  maxMoves = 2000,
}: {
  player: SelfPlayer;
  seed: number;
  numPlayers?: number;
  gameOptions?: Partial<GameOptions>;
  maxPerInput?: number;
  maxMoves?: number;
}): GameRecord {
  return withRng(createSeededRng(seed), () => {
    const players = Array.from(
      { length: numPlayers },
      (_, i) =>
        new Player({
          name: `Seat ${i + 1}`,
          playerId: `seat-${i}`,
          playerSecret: `seat-${i}`,
        })
    );
    let gameState = GameState.initialGameState({
      players,
      gameOptions: { realtimePoints: false, ...gameOptions, allowUndo: false },
    });
    const positions: PositionRecord[] = [];
    let numMoves = 0;
    while (!gameState.isGameOver()) {
      if (numMoves >= maxMoves) {
        throw new Error(`Game exceeded ${maxMoves} moves (seed=${seed})`);
      }
      let legalMoves = getLegalMoves(gameState, { maxPerInput });
      if (legalMoves.length === 0) {
        throw new Error(`No legal moves (seed=${seed}, move=${numMoves})`);
      }
      const seat = gameState.players.findIndex(
        (p) => p.playerId === gameState.activePlayerId
      );
      const keys = legalMoves.map((m) => vocabularyKey(gameState, m));
      let decision: Decision =
        legalMoves.length === 1
          ? { moveIdx: 0, policy: null, rootValue: NaN }
          : player.decide(gameState, legalMoves, numMoves);
      positions.push({
        raw: encodeStateRaw(gameState, seat),
        seat,
        legalKeys: Array.from(
          new Set(
            keys
              .filter((k): k is string => k !== null)
              .map((k) => ACTION_KEY_INDEX.get(k)!)
          )
        ),
        policy: decision.policy ? policyByKey(keys, decision.policy) : null,
        rootValue: decision.rootValue,
      });
      for (;;) {
        try {
          gameState = gameState.next(
            cloneDeep(legalMoves[decision.moveIdx]),
            true,
            true
          );
          break;
        } catch (err) {
          // A rare stale option: drop it and let the player choose again.
          legalMoves = legalMoves.filter((_, i) => i !== decision.moveIdx);
          if (legalMoves.length === 0) {
            throw err;
          }
          decision = player.decide(gameState, legalMoves, numMoves);
        }
      }
      numMoves++;
    }
    return {
      seed,
      points: gameState.players.map((p) => p.getPoints(gameState)),
      numMoves,
      positions,
    };
  });
}

// ---------------------------------------------------------------------------
// Data files
// ---------------------------------------------------------------------------

export const SELFPLAY_FORMAT = "everdell-az-selfplay";
const MAGIC = "AZSP";

// Shared with train/train.py (data/<run>/encoding.json and every file header).
export type EncodingInfo = {
  numPlayers: number;
  stateDim: number;
  scales: number[];
  featureNames: string[];
  keys: string[];
};

export function encodingInfo(numPlayers: number): EncodingInfo {
  return {
    numPlayers,
    stateDim: stateDim(numPlayers),
    scales: featureScales(numPlayers),
    featureNames: featureNames(numPlayers),
    keys: ACTION_KEYS.slice(),
  };
}

// FNV-1a of the encoding, to detect data written with another encoding.
export function encodingHash(info: EncodingInfo): string {
  const text = JSON.stringify([
    info.numPlayers,
    info.stateDim,
    info.scales,
    info.keys,
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

type Dtype = "u1" | "<u2" | "<u4" | "<f4";
const DTYPE_BYTES: Record<Dtype, number> = {
  u1: 1,
  "<u2": 2,
  "<u4": 4,
  "<f4": 4,
};

export type SectionInfo = {
  name: string;
  dtype: Dtype;
  count: number;
  // Byte offset from the start of the data, which follows the header.
  offset: number;
};

export type GameMeta = {
  seed: number;
  points: number[];
  numMoves: number;
  numPositions: number;
};

export type SelfPlayFileHeader = {
  format: typeof SELFPLAY_FORMAT;
  version: 1;
  encodingHash: string;
  numPlayers: number;
  stateDim: number;
  numKeys: number;
  numPositions: number;
  sections: SectionInfo[];
  games: GameMeta[];
  // Free-form provenance (generation, model, search settings).
  info: Record<string, unknown>;
};

const pad4 = (n: number) => (n + 3) & ~3;

/**
 * Serializes games: a 12-byte preamble ("AZSP", version, header length H), a
 * JSON header padded to H bytes (a multiple of 4), then the data: 4-byte
 * aligned little-endian sections at header.sections[].offset (relative to
 * byte 12 + H), one value per position unless noted:
 *   states u1[N*stateDim], seat u1, hasPolicy u1, legalMask u1[N*ceil(K/8)]
 *   (bit k%8 of byte k/8), z f4 (win 1 / tie 0 / loss -1), margin f4 (VP),
 *   rootValue f4 (NaN: none), game u4 (index in header.games), move u4,
 *   policyOffsets u4[N+1], policyKeys u2[P], policyProbs f4[P].
 */
export function encodeSelfPlayFile(
  games: GameRecord[],
  info: Record<string, unknown> = {}
): Uint8Array {
  if (games.length === 0) {
    throw new Error("No games to write");
  }
  const numPlayers = games[0].points.length;
  const encoding = encodingInfo(numPlayers);
  const dim = encoding.stateDim;
  const numKeys = encoding.keys.length;
  const maskBytes = Math.ceil(numKeys / 8);
  const N = games.reduce((n, g) => n + g.positions.length, 0);
  const P = games.reduce(
    (n, g) =>
      n + g.positions.reduce((m, p) => m + (p.policy ? p.policy.size : 0), 0),
    0
  );
  const counts: [string, Dtype, number][] = [
    ["states", "u1", N * dim],
    ["seat", "u1", N],
    ["hasPolicy", "u1", N],
    ["legalMask", "u1", N * maskBytes],
    ["z", "<f4", N],
    ["margin", "<f4", N],
    ["rootValue", "<f4", N],
    ["game", "<u4", N],
    ["move", "<u4", N],
    ["policyOffsets", "<u4", N + 1],
    ["policyKeys", "<u2", P],
    ["policyProbs", "<f4", P],
  ];
  let dataBytes = 0;
  const sections: SectionInfo[] = counts.map(([name, dtype, count]) => {
    const section = { name, dtype, count, offset: dataBytes };
    dataBytes = pad4(dataBytes + count * DTYPE_BYTES[dtype]);
    return section;
  });

  const header: SelfPlayFileHeader = {
    format: SELFPLAY_FORMAT,
    version: 1,
    encodingHash: encodingHash(encoding),
    numPlayers,
    stateDim: dim,
    numKeys,
    numPositions: N,
    sections,
    games: games.map((g) => ({
      seed: g.seed,
      points: g.points,
      numMoves: g.numMoves,
      numPositions: g.positions.length,
    })),
    info,
  };
  const headerText = Buffer.from(JSON.stringify(header), "utf8");
  const headerBytes = pad4(headerText.length);
  const dataStart = 12 + headerBytes;
  const bytes = new Uint8Array(dataStart + dataBytes);
  const view = new DataView(bytes.buffer);
  bytes.set(Buffer.from(MAGIC, "ascii"), 0);
  view.setUint32(4, 1, true);
  view.setUint32(8, headerBytes, true);
  bytes.fill(0x20, 12, dataStart);
  bytes.set(headerText, 12);

  const at = (name: string) =>
    dataStart + sections.find((sec) => sec.name === name)!.offset;
  const s = {
    states: at("states"),
    seat: at("seat"),
    hasPolicy: at("hasPolicy"),
    legalMask: at("legalMask"),
    z: at("z"),
    margin: at("margin"),
    rootValue: at("rootValue"),
    game: at("game"),
    move: at("move"),
    policyOffsets: at("policyOffsets"),
    policyKeys: at("policyKeys"),
    policyProbs: at("policyProbs"),
  };
  let i = 0;
  let p = 0;
  games.forEach((g, gameIdx) => {
    const outcome = terminalValues(g.points);
    g.positions.forEach((pos, move) => {
      bytes.set(pos.raw, s.states + i * dim);
      bytes[s.seat + i] = pos.seat;
      bytes[s.hasPolicy + i] = pos.policy ? 1 : 0;
      pos.legalKeys.forEach((k) => {
        bytes[s.legalMask + i * maskBytes + (k >> 3)] |= 1 << (k & 7);
      });
      const others = g.points.filter((_, seat) => seat !== pos.seat);
      view.setFloat32(s.z + 4 * i, outcome[pos.seat], true);
      view.setFloat32(
        s.margin + 4 * i,
        g.points[pos.seat] - Math.max(...others),
        true
      );
      view.setFloat32(s.rootValue + 4 * i, pos.rootValue, true);
      view.setUint32(s.game + 4 * i, gameIdx, true);
      view.setUint32(s.move + 4 * i, move, true);
      view.setUint32(s.policyOffsets + 4 * i, p, true);
      pos.policy?.forEach((prob, k) => {
        view.setUint16(s.policyKeys + 2 * p, k, true);
        view.setFloat32(s.policyProbs + 4 * p, prob, true);
        p++;
      });
      i++;
    });
  });
  view.setUint32(s.policyOffsets + 4 * N, p, true);
  return bytes;
}

export type DecodedPosition = {
  raw: Uint8Array;
  seat: number;
  legalKeys: number[];
  policy: Map<number, number> | null;
  z: number;
  margin: number;
  rootValue: number;
  game: number;
  move: number;
};

// Inverse of encodeSelfPlayFile (for tests and tools; the trainer is Python).
export function decodeSelfPlayFile(
  bytes: Uint8Array
): { header: SelfPlayFileHeader; positions: DecodedPosition[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = Buffer.from(bytes.subarray(0, 4)).toString("ascii");
  if (magic !== MAGIC || view.getUint32(4, true) !== 1) {
    throw new Error("Not a self-play file (version 1)");
  }
  const headerBytes = view.getUint32(8, true);
  const header = JSON.parse(
    Buffer.from(bytes.subarray(12, 12 + headerBytes)).toString("utf8")
  ) as SelfPlayFileHeader;
  const sectionStart = new Map(
    header.sections.map((sec) => [sec.name, 12 + headerBytes + sec.offset])
  );
  const at = (name: string) => sectionStart.get(name)!;
  const dim = header.stateDim;
  const maskBytes = Math.ceil(header.numKeys / 8);
  const positions: DecodedPosition[] = [];
  for (let i = 0; i < header.numPositions; i++) {
    const legalKeys: number[] = [];
    for (let k = 0; k < header.numKeys; k++) {
      if (bytes[at("legalMask") + i * maskBytes + (k >> 3)] & (1 << (k & 7))) {
        legalKeys.push(k);
      }
    }
    let policy: Map<number, number> | null = null;
    if (bytes[at("hasPolicy") + i]) {
      policy = new Map();
      const from = view.getUint32(at("policyOffsets") + 4 * i, true);
      const to = view.getUint32(at("policyOffsets") + 4 * (i + 1), true);
      for (let p = from; p < to; p++) {
        policy.set(
          view.getUint16(at("policyKeys") + 2 * p, true),
          view.getFloat32(at("policyProbs") + 4 * p, true)
        );
      }
    }
    positions.push({
      raw: bytes.slice(at("states") + i * dim, at("states") + (i + 1) * dim),
      seat: bytes[at("seat") + i],
      legalKeys,
      policy,
      z: view.getFloat32(at("z") + 4 * i, true),
      margin: view.getFloat32(at("margin") + 4 * i, true),
      rootValue: view.getFloat32(at("rootValue") + 4 * i, true),
      game: view.getUint32(at("game") + 4 * i, true),
      move: view.getUint32(at("move") + 4 * i, true),
    });
  }
  return { header, positions };
}
