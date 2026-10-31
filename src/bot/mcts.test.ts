import expect from "expect.js";
import { createSeededRng, Rng } from "../model/random";
import {
  Evaluator,
  MctsOptions,
  SearchGame,
  normalizePriors,
  runMcts,
  sampleDirichlet,
  sampleGamma,
  sampleIndex,
  visitPolicy,
} from "./mcts";

// Cells hold -1 (empty) or the seat that played there. With `twoStep`, a move
// is split in two consecutive decisions of the same player: row, then column.
type Board = { cells: number[]; toMove: number; pendingRow: number | null };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winner(cells: number[]): number | null {
  for (const [a, b, c] of LINES) {
    if (cells[a] !== -1 && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

class TicTacToe implements SearchGame<Board, number> {
  readonly numPlayers = 2;
  private readonly twoStep: boolean;
  constructor(twoStep = false) {
    this.twoStep = twoStep;
  }

  playerToMove(s: Board): number {
    return s.toMove;
  }
  isTerminal(s: Board): boolean {
    return winner(s.cells) !== null || s.cells.every((c) => c !== -1);
  }
  terminalValues(s: Board): number[] {
    const w = winner(s.cells);
    return w === null ? [0, 0] : w === 0 ? [1, -1] : [-1, 1];
  }
  legalActions(s: Board): number[] {
    const empty = s.cells
      .map((c, i) => (c === -1 ? i : -1))
      .filter((i) => i !== -1);
    if (!this.twoStep) {
      return empty;
    }
    if (s.pendingRow === null) {
      return [0, 1, 2].filter((r) =>
        empty.some((i) => Math.floor(i / 3) === r)
      );
    }
    return empty.filter((i) => Math.floor(i / 3) === s.pendingRow);
  }
  apply(s: Board, a: number): Board {
    if (this.twoStep && s.pendingRow === null) {
      return { ...s, pendingRow: a };
    }
    if (s.cells[a] !== -1) {
      throw new Error(`Cell ${a} is taken`);
    }
    const cells = s.cells.slice();
    cells[a] = s.toMove;
    return { cells, toMove: 1 - s.toMove, pendingRow: null };
  }
  actionKey(s: Board, a: number): string | null {
    return `${s.pendingRow === null ? "" : "col"}${a}`;
  }
}

const uniform: Evaluator<Board, number> = {
  evaluate: (_s, legal) => ({
    priors: legal.map(() => 1 / legal.length),
    values: [0, 0],
  }),
};

function board(rows: string, toMove: number): Board {
  const cells = rows
    .replace(/\s/g, "")
    .split("")
    .map((c) => (c === "X" ? 0 : c === "O" ? 1 : -1));
  return { cells, toMove, pendingRow: null };
}

function mostVisited(visits: number[]): number {
  return visits.indexOf(Math.max(...visits));
}

function searchMove(
  game: TicTacToe,
  s: Board,
  opts: Partial<MctsOptions<number>> & { rng: Rng }
): number {
  const result = runMcts(game, uniform, s, {
    simulations: 400,
    cPuct: 1.5,
    ...opts,
  });
  return result.actions[mostVisited(result.visits)];
}

// Plays MCTS (seat mctsSeat) against a uniformly random player.
function playVsRandom(
  game: TicTacToe,
  mctsSeat: number,
  rng: Rng,
  opts: Partial<MctsOptions<number>>
): number[] {
  let s: Board = { cells: new Array(9).fill(-1), toMove: 0, pendingRow: null };
  while (!game.isTerminal(s)) {
    const legal = game.legalActions(s);
    const a =
      s.toMove === mctsSeat
        ? searchMove(game, s, { ...opts, rng })
        : legal[Math.floor(rng() * legal.length)];
    s = game.apply(s, a);
  }
  return game.terminalValues(s);
}

describe("mcts", () => {
  (["parent", "zero"] as const).forEach((fpuValue) => {
    describe(`tic-tac-toe (fpu=${fpuValue})`, () => {
      const game = new TicTacToe();

      // With v = 0 at every non-terminal leaf, 400 simulations cannot see forks
      // that are 7 plies deep (eg. X:7 O:0? X:6 O:8 X:4): ~1% of the games
      // against a random player are lost. 1600 simulations see them all.
      it("rarely loses against a random player (400 simulations)", function () {
        this.timeout(60000);
        const rng = createSeededRng(1);
        let losses = 0;
        for (let g = 0; g < 100; g++) {
          const seat = g % 2;
          const values = playVsRandom(game, seat, rng, { fpuValue });
          losses += values[seat] === -1 ? 1 : 0;
        }
        expect(losses <= 3).to.be(true);
      });

      it("never loses against a random player (1600 simulations)", function () {
        this.timeout(60000);
        const rng = createSeededRng(1);
        for (let g = 0; g < 100; g++) {
          const seat = g % 2;
          const values = playVsRandom(game, seat, rng, {
            fpuValue,
            simulations: 1600,
          });
          expect(values[seat]).to.not.be(-1);
        }
      });

      it("takes an immediate win", () => {
        // X to move wins with cell 2; O also threatens cell 8.
        const s = board("XX. OO. ...", 0);
        expect(
          searchMove(game, s, { fpuValue, rng: createSeededRng(2) })
        ).to.be(2);
        // Same for O.
        const t = board("XX. OO. X..", 1);
        expect(
          searchMove(game, t, { fpuValue, rng: createSeededRng(2) })
        ).to.be(5);
      });

      it("blocks an immediate threat", () => {
        // O to move must block cell 2.
        const s = board("XX. .O. ...", 1);
        expect(
          searchMove(game, s, { fpuValue, rng: createSeededRng(3) })
        ).to.be(2);
        // X to move must block cell 7.
        const t = board("XO. .OX ...", 0);
        expect(
          searchMove(game, t, { fpuValue, rng: createSeededRng(3) })
        ).to.be(7);
      });

      it("is deterministic for a given rng seed", () => {
        const s = board("X.. ... ...", 1);
        const run = () =>
          runMcts(game, uniform, s, {
            simulations: 300,
            cPuct: 1.5,
            fpuValue,
            rootDirichletAlpha: 0.5,
            rng: createSeededRng(42),
          }).visits;
        expect(run()).to.eql(run());
      });
    });
  });

  describe("two-step tic-tac-toe (same player moves twice in a row)", () => {
    const game = new TicTacToe(true);

    it("never loses against a random player", function () {
      this.timeout(60000);
      const rng = createSeededRng(5);
      for (let g = 0; g < 50; g++) {
        const seat = g % 2;
        const values = playVsRandom(game, seat, rng, { simulations: 800 });
        expect(values[seat]).to.not.be(-1);
      }
    });

    it("chooses the row, then the column of an immediate win", () => {
      const s = board("... OO. XX.", 0);
      const row = searchMove(game, s, { rng: createSeededRng(6) });
      expect(row).to.be(2);
      const col = searchMove(game, game.apply(s, row), {
        rng: createSeededRng(6),
      });
      expect(col).to.be(8);
    });
  });

  describe("search bookkeeping", () => {
    const game = new TicTacToe();

    it("counts one visit per simulation and backs up zero-sum vectors", () => {
      const s = board("XX. OO. ...", 0);
      const result = runMcts(game, uniform, s, {
        simulations: 200,
        cPuct: 1.5,
        rng: createSeededRng(1),
      });
      expect(result.visits.reduce((a, b) => a + b, 0)).to.be(200);
      expect(result.player).to.be(0);
      result.childValues.forEach((v) => {
        if (v) {
          expect(Math.abs(v[0] + v[1]) < 1e-9).to.be(true);
        }
      });
      const win = result.actions.indexOf(2);
      expect(result.childValues[win]).to.eql([1, -1]);
      expect(result.rootVisits.get("2")).to.be(result.visits[win]);
    });

    it("breaks exact ties at random, not in enumeration order", () => {
      const s = board("... ... ...", 0);
      const counts = new Array(9).fill(0);
      for (let seed = 0; seed < 180; seed++) {
        // 10 simulations over 9 equal moves: one move gets a second visit.
        const { visits, actions } = runMcts(game, uniform, s, {
          simulations: 10,
          cPuct: 1.5,
          rng: createSeededRng(seed),
        });
        counts[actions[mostVisited(visits)]]++;
      }
      counts.forEach((c) => expect(c > 5 && c < 40).to.be(true));
    });

    it("drops actions whose apply throws", () => {
      const s = board("X.. ... ...", 1);
      const result = runMcts(game, uniform, s, {
        simulations: 100,
        cPuct: 1.5,
        rng: createSeededRng(1),
        // Cell 0 is taken: the game rejects it.
        rootActions: [0, 4, 8],
      });
      expect(result.valid).to.eql([false, true, true]);
      expect(result.visits[0]).to.be(0);
      expect(result.visits[1] + result.visits[2]).to.be(100);
    });

    it("returns an empty result at a terminal root", () => {
      const s = board("XXX OO. ...", 1);
      const result = runMcts(game, uniform, s, {
        simulations: 10,
        cPuct: 1.5,
        rng: createSeededRng(1),
      });
      expect(result.actions).to.eql([]);
      expect(result.rootValue).to.eql([1, -1]);
    });

    it("adds Dirichlet noise to the root priors only when asked", () => {
      const s = board("... ... ...", 0);
      const base = runMcts(game, uniform, s, {
        simulations: 1,
        cPuct: 1.5,
        rng: createSeededRng(1),
      });
      base.priors.forEach((p) =>
        expect(Math.abs(p - 1 / 9) < 1e-12).to.be(true)
      );
      const noisy = runMcts(game, uniform, s, {
        simulations: 1,
        cPuct: 1.5,
        rootDirichletAlpha: 1,
        rng: createSeededRng(1),
      });
      const total = noisy.priors.reduce((a, b) => a + b, 0);
      expect(Math.abs(total - 1) < 1e-9).to.be(true);
      expect(noisy.priors.some((p) => Math.abs(p - 1 / 9) > 1e-3)).to.be(true);
      noisy.priors.forEach((p) => expect(p >= 0.75 / 9).to.be(true));
    });
  });

  describe("helpers", () => {
    it("normalizePriors gives null-keyed actions 1/n", () => {
      expect(normalizePriors([0.25, 0.75], ["a", "b"])).to.eql([0.25, 0.75]);
      const p = normalizePriors([0.5, 0.5, 123, 0], ["a", "b", null, null]);
      expect(p).to.eql([0.25, 0.25, 0.25, 0.25]);
      const q = normalizePriors([3, 1, 0], ["a", "b", null]);
      expect(q.map((x) => Math.round(x * 1000) / 1000)).to.eql([
        0.5,
        0.167,
        0.333,
      ]);
      // All-zero keyed priors fall back to uniform.
      expect(normalizePriors([0, 0], ["a", "b"])).to.eql([0.5, 0.5]);
    });

    it("visitPolicy sharpens with the temperature", () => {
      expect(visitPolicy([1, 3], 1)).to.eql([0.25, 0.75]);
      expect(visitPolicy([1, 3, 3], 0)).to.eql([0, 0.5, 0.5]);
      const sharp = visitPolicy([1, 3], 0.5);
      expect(sharp[1]).to.be(0.9);
    });

    it("sampleIndex follows the probabilities", () => {
      const rng = createSeededRng(9);
      const counts = [0, 0, 0];
      for (let i = 0; i < 3000; i++) {
        counts[sampleIndex([0.2, 0, 0.8], rng)]++;
      }
      expect(counts[1]).to.be(0);
      expect(Math.abs(counts[0] / 3000 - 0.2) < 0.03).to.be(true);
    });

    it("samples Gamma and Dirichlet variates with the right mean", () => {
      const rng = createSeededRng(10);
      [0.3, 1, 2.5].forEach((alpha) => {
        let total = 0;
        for (let i = 0; i < 4000; i++) {
          total += sampleGamma(alpha, rng);
        }
        expect(Math.abs(total / 4000 - alpha) < 0.1 * alpha + 0.02).to.be(true);
      });
      const d = sampleDirichlet(5, 0.3, rng);
      expect(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-9).to.be(true);
      d.forEach((x) => expect(x >= 0).to.be(true));
    });
  });
});
