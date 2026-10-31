// Game-agnostic Monte Carlo Tree Search with PUCT selection (AlphaZero style).
//
// Values are vectors with one entry per seat: the player to move at a node
// maximizes their own entry (max^n). For 2-player zero-sum games this is the
// textbook algorithm, and it stays correct when the same player moves several
// times in a row (multi-step inputs).
import { Rng } from "../model/random";

export interface SearchGame<S, A> {
  readonly numPlayers: number;
  // Seat index 0..numPlayers-1.
  playerToMove(s: S): number;
  isTerminal(s: S): boolean;
  // Per seat, in [-1, 1]; only called when isTerminal.
  terminalValues(s: S): number[];
  legalActions(s: S): A[];
  // May throw: the search then drops that action.
  apply(s: S, a: A): S;
  // Stable id for priors/targets; null = "no prior for this action".
  actionKey(s: S, a: A): string | null;
}

export type Evaluation = {
  // Aligned with `legal`. Keyed actions share a probability mass of 1 (actions
  // with the same key split their key's probability); entries of null-keyed
  // actions are ignored, the search gives those 1/n each.
  priors: number[];
  // Per seat, in [-1, 1].
  values: number[];
};

export interface Evaluator<S, A> {
  // `keys[i]` is `game.actionKey(s, legal[i])`, computed once by the search.
  evaluate(s: S, legal: A[], keys: (string | null)[]): Evaluation;
  // Called once at the start of every search.
  beginSearch?(root: S): void;
}

export type MctsOptions<A = unknown> = {
  simulations: number;
  // 1.5 to start, tune in [1, 2.5].
  cPuct: number;
  // undefined = no noise (evaluation), ~1.0 for self-play.
  rootDirichletAlpha?: number;
  rootDirichletEpsilon?: number;
  // Q of unvisited children: the evaluator's value at the parent (default) or 0.
  fpuValue?: "parent" | "zero";
  rng: Rng;
  // Actions at the root instead of game.legalActions(root), e.g. the exact
  // moves the caller has to choose from.
  rootActions?: A[];
};

export type MctsResult<A> = {
  // Aligned with the root actions.
  actions: A[];
  keys: (string | null)[];
  visits: number[];
  // Root priors used by the search (after noise).
  priors: number[];
  // Mean value vector of each root child (W / N); null when never visited.
  childValues: (number[] | null)[];
  // False for root actions whose `apply` threw.
  valid: boolean[];
  // Mean value vector at the root.
  rootValue: number[];
  // Visits summed by action key; null-keyed actions use "#" + JSON of the action.
  rootVisits: Map<string, number>;
  // Seat to move at the root (-1 when the root is terminal).
  player: number;
};

class Node<S, A> {
  readonly state: S;
  readonly player: number;
  readonly terminal: boolean;
  N = 0;
  readonly W: number[];
  expanded = false;
  // Non-terminal node without any action the game accepts.
  dead = false;
  // Evaluator (or terminal) value of this node; parent FPU.
  value: number[] = [];
  actions: A[] = [];
  keys: (string | null)[] = [];
  priors: number[] = [];
  children: (Node<S, A> | null)[] = [];
  invalid: boolean[] = [];

  constructor(game: SearchGame<S, A>, state: S) {
    this.state = state;
    this.terminal = game.isTerminal(state);
    this.player = this.terminal ? -1 : game.playerToMove(state);
    this.W = new Array(game.numPlayers).fill(0);
    if (this.terminal) {
      this.value = game.terminalValues(state);
    }
  }
}

export function runMcts<S, A>(
  game: SearchGame<S, A>,
  evaluator: Evaluator<S, A>,
  rootState: S,
  opts: MctsOptions<A>
): MctsResult<A> {
  const {
    simulations,
    cPuct,
    rootDirichletAlpha,
    rootDirichletEpsilon = 0.25,
    fpuValue = "parent",
    rng,
    rootActions,
  } = opts;
  const numPlayers = game.numPlayers;

  const expand = (node: Node<S, A>, actions: A[]): number[] => {
    node.expanded = true;
    if (actions.length === 0) {
      node.dead = true;
      node.value = evaluator.evaluate(node.state, [], []).values;
      return node.value;
    }
    const keys = actions.map((a) => game.actionKey(node.state, a));
    const { priors, values } = evaluator.evaluate(node.state, actions, keys);
    node.actions = actions;
    node.keys = keys;
    node.priors = normalizePriors(priors, keys);
    node.children = new Array(actions.length).fill(null);
    node.invalid = new Array(actions.length).fill(false);
    node.value = values;
    return values;
  };

  // Index of the child maximizing Q + U, or -1 when every child is invalid.
  // Exact ties (eg. unvisited children with equal priors) are broken
  // uniformly at random: in enumeration order, the first legal moves would
  // systematically get explored, and chosen, first.
  const select = (node: Node<S, A>): number => {
    const p = node.player;
    const sqrtN = Math.sqrt(node.N);
    const fpu = fpuValue === "zero" ? 0 : node.value[p];
    let best = -1;
    let bestScore = -Infinity;
    let ties = 0;
    for (let i = 0; i < node.actions.length; i++) {
      if (node.invalid[i]) {
        continue;
      }
      const child = node.children[i];
      const n = child ? child.N : 0;
      const q = n > 0 ? child!.W[p] / n : fpu;
      const score = q + (cPuct * node.priors[i] * sqrtN) / (1 + n);
      if (score > bestScore) {
        bestScore = score;
        best = i;
        ties = 1;
      } else if (score === bestScore && rng() * ++ties < 1) {
        best = i;
      }
    }
    return best;
  };

  const backup = (path: Node<S, A>[], v: number[]) => {
    for (const node of path) {
      node.N += 1;
      for (let i = 0; i < numPlayers; i++) {
        node.W[i] += v[i];
      }
    }
  };

  const root = new Node(game, rootState);
  evaluator.beginSearch?.(rootState);
  if (!root.terminal) {
    backup(
      [root],
      expand(
        root,
        rootActions ? rootActions.slice() : game.legalActions(rootState)
      )
    );
    if (
      rootDirichletAlpha &&
      rootDirichletAlpha > 0 &&
      root.actions.length > 1
    ) {
      const noise = sampleDirichlet(
        root.actions.length,
        rootDirichletAlpha,
        rng
      );
      root.priors = root.priors.map(
        (p, i) =>
          (1 - rootDirichletEpsilon) * p + rootDirichletEpsilon * noise[i]
      );
    }
  } else {
    backup([root], root.value);
  }

  for (let sim = 0; sim < simulations && !root.terminal && !root.dead; sim++) {
    const path = [root];
    let node = root;
    while (node.expanded && !node.dead) {
      const idx = select(node);
      if (idx === -1) {
        node.dead = true;
        break;
      }
      let child = node.children[idx];
      if (!child) {
        try {
          child = new Node(game, game.apply(node.state, node.actions[idx]));
        } catch (e) {
          node.invalid[idx] = true;
          continue;
        }
        node.children[idx] = child;
      }
      node = child;
      path.push(node);
      if (node.terminal) {
        break;
      }
    }
    let v: number[];
    if (node.terminal || node.dead) {
      v = node.value;
    } else {
      v = expand(node, game.legalActions(node.state));
    }
    backup(path, v);
  }

  const rootVisits = new Map<string, number>();
  const visits = root.actions.map((a, i) => {
    const n = root.children[i]?.N ?? 0;
    const key = root.keys[i] ?? "#" + JSON.stringify(a);
    rootVisits.set(key, (rootVisits.get(key) || 0) + n);
    return n;
  });
  return {
    actions: root.actions,
    keys: root.keys,
    visits,
    priors: root.priors,
    childValues: root.children.map((c) =>
      c && c.N > 0 ? c.W.map((w) => w / c.N) : null
    ),
    valid: root.invalid.map((x) => !x),
    rootValue: root.W.map((w) => w / Math.max(1, root.N)),
    rootVisits,
    player: root.player,
  };
}

// Null-keyed actions get 1/n each; keyed actions share the remaining (n-m)/n in
// proportion to the evaluator's priors (uniformly if those are all zero).
export function normalizePriors(
  priors: number[],
  keys: (string | null)[]
): number[] {
  const n = keys.length;
  let keyedSum = 0;
  let numKeyed = 0;
  keys.forEach((key, i) => {
    if (key !== null) {
      numKeyed++;
      const p = priors[i];
      keyedSum += p > 0 ? p : 0;
    }
  });
  const keyedMass = numKeyed / n;
  return keys.map((key, i) => {
    if (key === null || !(keyedSum > 0)) {
      return 1 / n;
    }
    const p = priors[i];
    return ((p > 0 ? p : 0) / keyedSum) * keyedMass;
  });
}

// pi(a) ∝ N(a)^(1/temperature); temperature 0 = argmax (ties split evenly).
export function visitPolicy(visits: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const max = Math.max(...visits);
    const numMax = visits.filter((n) => n === max).length;
    return visits.map((n) => (n === max ? 1 / numMax : 0));
  }
  const powered = visits.map((n) => Math.pow(n, 1 / temperature));
  const total = powered.reduce((a, b) => a + b, 0);
  if (!(total > 0)) {
    return visits.map(() => 1 / visits.length);
  }
  return powered.map((x) => x / total);
}

export function sampleIndex(probs: number[], rng: Rng): number {
  let u = rng() * probs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < probs.length; i++) {
    u -= probs[i];
    if (u < 0) {
      return i;
    }
  }
  // Rounding: the last index with a positive probability.
  for (let i = probs.length - 1; i >= 0; i--) {
    if (probs[i] > 0) {
      return i;
    }
  }
  return probs.length - 1;
}

export function sampleDirichlet(n: number, alpha: number, rng: Rng): number[] {
  const x = new Array(n)
    .fill(0)
    .map(() => (alpha === 1 ? -Math.log(1 - rng()) : sampleGamma(alpha, rng)));
  const total = x.reduce((a, b) => a + b, 0);
  return total > 0 ? x.map((v) => v / total) : x.map(() => 1 / n);
}

// Marsaglia & Tsang (2000); alpha < 1 via the boost Gamma(a) = Gamma(a+1) U^(1/a).
export function sampleGamma(alpha: number, rng: Rng): number {
  if (alpha < 1) {
    return sampleGamma(alpha + 1, rng) * Math.pow(1 - rng(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = sampleGaussian(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = 1 - rng();
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function sampleGaussian(rng: Rng): number {
  const u1 = 1 - rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
