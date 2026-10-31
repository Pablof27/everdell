import expect from "expect.js";
import fs from "fs";
import os from "os";
import path from "path";
import { createSeededRng } from "../model/random";
import { createBot } from "./bot";
import { MctsBot } from "./mctsBot";
import { GreedyBot } from "./greedyBot";
import { handTunedWeights } from "./evaluations";
import { STATE_DIM } from "./encodeState";
import { NUM_ACTION_KEYS } from "./actionKey";
import {
  GameRecord,
  GreedySelfPlayer,
  MctsSelfPlayer,
  decodeSelfPlayFile,
  encodeSelfPlayFile,
  encodingHash,
  encodingInfo,
  playSelfPlayGame,
} from "./selfplay";
import { playSelfPlayBatch } from "./botWorker";

describe("self-play", () => {
  let games: GameRecord[];

  before(function () {
    this.timeout(120000);
    const rng = createSeededRng(1);
    const bot = createBot("MCTS_V", { rng, simulations: 8 }) as MctsBot;
    const player = new MctsSelfPlayer(bot, rng, {
      simulations: 8,
      temperatureDecisions: 30,
      fullSearchProb: 0.5,
      fastSimulations: 2,
    });
    games = [1, 2, 3].map((seed) => playSelfPlayGame({ player, seed }));
  });

  it("records one position per decision of finished games", () => {
    games.forEach((g) => {
      expect(g.positions.length).to.be(g.numMoves);
      expect(g.numMoves > 40 && g.numMoves < 200).to.be(true);
      expect(g.points.length).to.be(2);
      g.positions.forEach((p) => {
        expect(p.raw.length).to.be(STATE_DIM);
        expect(p.seat === 0 || p.seat === 1).to.be(true);
      });
    });
  });

  it("writes and reads back the binary format", () => {
    const bytes = encodeSelfPlayFile(games, { generation: 7 });
    const { header, positions } = decodeSelfPlayFile(bytes);
    expect(header.encodingHash).to.be(encodingHash(encodingInfo(2)));
    expect(header.numKeys).to.be(NUM_ACTION_KEYS);
    expect(header.info.generation).to.be(7);
    expect(header.games.map((g) => g.points)).to.eql(
      games.map((g) => g.points)
    );
    const records = games.flatMap((g) => g.positions);
    expect(positions.length).to.be(records.length);
    let numPolicies = 0;
    positions.forEach((p, i) => {
      const g = games[p.game];
      expect(Array.from(p.raw)).to.eql(Array.from(records[i].raw));
      expect(p.seat).to.be(records[i].seat);
      expect(p.legalKeys).to.eql(
        records[i].legalKeys.slice().sort((a, b) => a - b)
      );
      // z matches the sign of the final margin, from the mover's seat.
      const mine = g.points[p.seat];
      const theirs = g.points[1 - p.seat];
      expect(p.margin).to.be(mine - theirs);
      expect(p.z).to.be(Math.sign(mine - theirs));
      if (p.policy) {
        numPolicies++;
        let total = 0;
        p.policy.forEach((prob, k) => {
          expect(p.legalKeys.includes(k)).to.be(true);
          total += prob;
        });
        expect(Math.abs(total - 1) < 1e-5).to.be(true);
      }
    });
    // Playout cap randomization: only some of the searched decisions.
    expect(numPolicies > 0.1 * positions.length).to.be(true);
    expect(numPolicies < 0.7 * positions.length).to.be(true);
  });

  it("records one-hot greedy targets for the warm start", function () {
    this.timeout(60000);
    const rng = createSeededRng(3);
    const player = new GreedySelfPlayer(
      new GreedyBot({ rng, weights: handTunedWeights() })
    );
    const game = playSelfPlayGame({ player, seed: 5 });
    const withPolicy = game.positions.filter((p) => p.policy);
    expect(withPolicy.length > 0).to.be(true);
    withPolicy.forEach((p) => {
      const probs = Array.from(p.policy!.values());
      expect(probs.filter((x) => x === 1).length).to.be(1);
    });
  });

  it("plays worker batches into data files", function () {
    this.timeout(60000);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "selfplay-"));
    const outFile = path.join(dir, "batch-00000.bin");
    const result = playSelfPlayBatch({
      type: "selfplay",
      spec: { botType: "MCTS_V", simulations: 4 },
      seeds: [11],
      botSeed: 1,
      outFile,
      search: { simulations: 4 },
      info: { generation: 1 },
    });
    expect(result.file).to.be(outFile);
    expect(result.games).to.be(1);
    const { header, positions } = decodeSelfPlayFile(fs.readFileSync(outFile));
    expect(positions.length).to.be(result.positions);
    expect(header.info.generation).to.be(1);
    fs.rmSync(dir, { recursive: true });
  });
});
