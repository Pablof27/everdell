// Everdell as a SearchGame for mcts.ts, and the stage-2 linear evaluation
// wrapped as a leaf evaluator (MCTS_V).
import cloneDeep from "lodash/cloneDeep";
import { GameState } from "../model/gameState";
import { GameInput } from "../model/types";
import { Rng, random } from "../model/random";
import { Evaluation, Evaluator, SearchGame } from "./mcts";
import { getLegalMoves } from "./legalMoves";
import { vocabularyKey } from "./actionKey";
import { Weights, evaluate } from "./evaluations";
import { GreedyBot } from "./greedyBot";

// For set-valued decisions the enumerator samples this many subsets: plenty for
// a tree with uniform priors, and it bounds the branching factor.
export const SEARCH_MAX_PER_INPUT = 16;

// V(me) - V(opponent) counts the points margin twice (own points and the
// "best opponent's points" feature, 12 VP per unit), so 10/6 ≈ a 10 VP margin.
export const DEFAULT_LINEAR_TEMPERATURE = 10 / 6;

export class EverdellSearchGame implements SearchGame<GameState, GameInput> {
  readonly numPlayers: number;
  private readonly seatByPlayerId: Record<string, number> = {};
  private readonly rng: Rng;
  private readonly maxPerInput: number;

  constructor(
    root: GameState,
    {
      rng,
      maxPerInput = SEARCH_MAX_PER_INPUT,
    }: { rng: Rng; maxPerInput?: number }
  ) {
    this.numPlayers = root.players.length;
    root.players.forEach((p, seat) => (this.seatByPlayerId[p.playerId] = seat));
    this.rng = rng;
    this.maxPerInput = maxPerInput;
  }

  playerToMove(s: GameState): number {
    return this.seatByPlayerId[s.activePlayerId];
  }

  isTerminal(s: GameState): boolean {
    return s.isGameOver();
  }

  terminalValues(s: GameState): number[] {
    return terminalValues(s.players.map((p) => p.getPoints(s)));
  }

  legalActions(s: GameState): GameInput[] {
    return getLegalMoves(s, { maxPerInput: this.maxPerInput, rng: this.rng });
  }

  apply(s: GameState, a: GameInput): GameState {
    // The engine annotates its input (playedCardContext): keep `a` pristine.
    return s.next(cloneDeep(a), true, true);
  }

  actionKey(s: GameState, a: GameInput): string | null {
    return vocabularyKey(s, a);
  }
}

// Winner +1, losers -1; tied winners 0 (a 2-player tie is 0, 0).
export function terminalValues(points: number[]): number[] {
  const best = Math.max(...points);
  const numBest = points.filter((p) => p === best).length;
  return points.map((p) => (p < best ? -1 : numBest === 1 ? 1 : 0));
}

// tanh((V(s, seat) - max over the others of V(s, other)) / temperature): exactly
// antisymmetric for 2 players.
export function linearValues(
  gameState: GameState,
  weights: Weights,
  temperature: number = DEFAULT_LINEAR_TEMPERATURE
): number[] {
  const v = gameState.players.map((p) =>
    evaluate(gameState, p.playerId, weights)
  );
  return v.map((mine, seat) => {
    let best = -Infinity;
    v.forEach((theirs, other) => {
      if (other !== seat && theirs > best) {
        best = theirs;
      }
    });
    return Math.tanh((mine - best) / temperature);
  });
}

// "difference": V as evolved, whose last feature already subtracts the best
// opponent's points, so V(me) - V(opponent) counts the points margin twice
// relative to the other features. "selfDifference": V without that feature,
// which keeps the evolved trade-off between points and resources.
// "rootPlayer": only the searching player's V, relative to its value at the
// root: tanh((V(s, me) - V(root, me)) / temperature) for me, the negation for
// the others (paranoid). The opponents' tempo terms (eg. available workers)
// then don't swing the value at every ply, and at depth 1 the search ranks
// moves exactly like GreedyBot. "zero": no evaluation at all (only terminal
// states count), the ladder baseline that should play like RANDOM.
export type LinearValueMode =
  | "difference"
  | "selfDifference"
  | "rootPlayer"
  | "zero";

export type LinearEvaluatorOptions = {
  temperature?: number;
  mode?: LinearValueMode;
  // Resolve the mover's pending sub-inputs greedily before evaluating, like
  // GreedyBot does after each move (the weights were evolved for that).
  resolvePending?: boolean;
  // Priors from a softmax over the mover's V after each move (temperature
  // `priorTemperature`, in V units): at sub-decisions only ("pending"), where
  // uniform priors make a move's value the average of its mostly bad
  // follow-ups, or at every node ("all"; one `next()` per legal move).
  greedyPriors?: "none" | "pending" | "all";
  priorTemperature?: number;
  rng?: Rng;
};

export const DEFAULT_PRIOR_TEMPERATURE = 0.2;

// The stage-2 linear V at the leaves; uniform (or 1-ply greedy) priors.
export class LinearEvaluator implements Evaluator<GameState, GameInput> {
  private readonly weights: Weights;
  private readonly valueWeights: Weights;
  private readonly temperature: number;
  private readonly mode: LinearValueMode;
  private readonly greedy: GreedyBot | null;
  private readonly greedyPriors: "none" | "pending" | "all";
  private readonly priorTemperature: number;
  private rootPlayerId: string | null = null;
  private rootValue = 0;

  constructor(weights: Weights, opts: LinearEvaluatorOptions = {}) {
    const {
      temperature = DEFAULT_LINEAR_TEMPERATURE,
      mode = "difference",
      resolvePending = false,
      greedyPriors = "none",
      priorTemperature = DEFAULT_PRIOR_TEMPERATURE,
      rng = random,
    } = opts;
    this.weights = weights;
    this.valueWeights =
      mode === "selfDifference"
        ? weights.map((row) =>
            row.map((w, i) => (i === row.length - 1 ? 0 : w))
          )
        : weights;
    this.temperature = temperature;
    this.mode = mode;
    this.greedy = resolvePending ? new GreedyBot({ rng, weights }) : null;
    this.greedyPriors = greedyPriors;
    this.priorTemperature = priorTemperature;
  }

  beginSearch(root: GameState): void {
    this.rootPlayerId = root.activePlayerId;
    this.rootValue = evaluate(root, root.activePlayerId, this.valueWeights);
  }

  evaluate(s: GameState, legal: GameInput[]): Evaluation {
    let leaf = s;
    if (this.greedy && s.pendingGameInputs.length > 0 && !s.isGameOver()) {
      leaf = this.greedy.resolvePendingGreedily(s, s.activePlayerId);
    }
    let values: number[];
    if (leaf.isGameOver()) {
      values = terminalValues(leaf.players.map((p) => p.getPoints(leaf)));
    } else if (this.mode === "zero") {
      values = leaf.players.map(() => 0);
    } else if (this.mode === "rootPlayer" && this.rootPlayerId) {
      const n = leaf.players.length;
      const mine = Math.tanh(
        (evaluate(leaf, this.rootPlayerId, this.valueWeights) -
          this.rootValue) /
          this.temperature
      );
      values = leaf.players.map((p) =>
        p.playerId === this.rootPlayerId ? mine : -mine / (n - 1)
      );
    } else {
      values = linearValues(leaf, this.valueWeights, this.temperature);
    }
    return { priors: this.priors(s, legal), values };
  }

  private priors(s: GameState, legal: GameInput[]): number[] {
    const wanted =
      this.greedyPriors === "all" ||
      (this.greedyPriors === "pending" && s.pendingGameInputs.length > 0);
    if (!wanted || legal.length < 2) {
      return legal.map(() => 1);
    }
    const mover = s.activePlayerId;
    const scores = legal.map((move) => {
      try {
        return evaluate(
          s.next(cloneDeep(move), true, true),
          mover,
          this.weights
        );
      } catch (e) {
        return null;
      }
    });
    const best = Math.max(...scores.map((x) => (x === null ? -Infinity : x)));
    if (!Number.isFinite(best)) {
      return legal.map(() => 1);
    }
    return scores.map((x) =>
      x === null ? 0 : Math.exp((x - best) / this.priorTemperature)
    );
  }
}
