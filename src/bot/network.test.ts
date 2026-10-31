import expect from "expect.js";
import fs from "fs";
import path from "path";
import { testInitialGameState } from "../model/testHelpers";
import { CardName, GameInputType, ResourceType } from "../model/types";
import { AzModel, ModelManifest, NetworkEvaluator, softmax } from "./network";
import { readModel } from "./modelFiles";
import { featureScales } from "./encodeState";
import { getLegalMoves } from "./legalMoves";
import { vocabularyKey } from "./actionKey";
import { normalizePriors } from "./mcts";
import { BOT_DIFFICULTIES } from "./difficulties";

// Exported by `train.py --export-fixture` (PyTorch, eval mode).
const FIXTURE = path.join(__dirname, "testdata", "tiny-model");

type TestVectors = {
  inputs: number[][];
  logits: number[][];
  value: number[];
  margin: number[];
};

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

describe("network", () => {
  const model = readModel(path.join(FIXTURE, "model.json"));
  const vectors: TestVectors = JSON.parse(
    fs.readFileSync(path.join(FIXTURE, "test_vectors.json"), "utf8")
  );
  const scales = featureScales(2);

  it("matches the PyTorch outputs (dense forward pass)", () => {
    expect(vectors.inputs.length).to.be(8);
    vectors.inputs.forEach((input, i) => {
      const out = model.forward(Float32Array.from(input));
      expect(out.logits.length).to.be(vectors.logits[i].length);
      expect(maxAbsDiff(out.logits, vectors.logits[i]) < 1e-4).to.be(true);
      expect(Math.abs(out.value - vectors.value[i]) < 1e-4).to.be(true);
      expect(Math.abs(out.margin - vectors.margin[i]) < 1e-4).to.be(true);
    });
  });

  it("matches them from raw features, for selected keys only", () => {
    vectors.inputs.forEach((input, i) => {
      const raw = Uint8Array.from(input, (x, j) => Math.round(x * scales[j]));
      const keys = [0, 5, 100, 867];
      const out = model.evaluateRaw(raw, keys);
      expect(
        maxAbsDiff(
          out.logits,
          keys.map((k) => vectors.logits[i][k])
        ) < 1e-4
      ).to.be(true);
      expect(Math.abs(out.value - vectors.value[i]) < 1e-4).to.be(true);
    });
  });

  it("refuses a model built for another vocabulary or encoding", () => {
    const manifest: ModelManifest = JSON.parse(
      fs.readFileSync(path.join(FIXTURE, "model.json"), "utf8")
    );
    const params = new Float32Array(manifest.numParams);
    expect(() => new AzModel(manifest, params)).to.not.throwException();
    const swapped = manifest.keys.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(
      () => new AzModel({ ...manifest, keys: swapped }, params)
    ).to.throwException(/vocabulary/);
    expect(
      () => new AzModel({ ...manifest, keys: manifest.keys.slice(1) }, params)
    ).to.throwException(/vocabulary/);
    const scales2 = manifest.scales.slice();
    scales2[3] = 99;
    expect(
      () => new AzModel({ ...manifest, scales: scales2 }, params)
    ).to.throwException(/encoding/);
    expect(
      () => new AzModel(manifest, new Float32Array(manifest.numParams - 1))
    ).to.throwException();
  });

  it("evaluates positions: masked priors over legal keys, antisymmetric values", () => {
    const gameState = testInitialGameState({
      cardsInHand: [CardName.FARM, CardName.MINE],
      meadowCards: [CardName.FARM, CardName.KING],
    });
    gameState.getActivePlayer().gainResources(gameState, {
      [ResourceType.TWIG]: 4,
      [ResourceType.RESIN]: 4,
    });
    const legal = getLegalMoves(gameState);
    const keys = legal.map((m) => vocabularyKey(gameState, m));
    const farms = legal.filter(
      (m) =>
        m.inputType === GameInputType.PLAY_CARD &&
        m.clientOptions.card === CardName.FARM
    );
    expect(farms.length > 1).to.be(true);

    const { priors, values } = new NetworkEvaluator(model).evaluate(
      gameState,
      legal,
      keys
    );
    expect(values.length).to.be(2);
    expect(values[0]).to.be(-values[1]);
    const total = priors.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1) < 1e-6).to.be(true);
    // Moves sharing a key split its probability evenly.
    const farmPriors = legal
      .map((m, i) => (farms.includes(m) ? priors[i] : -1))
      .filter((p) => p >= 0);
    farmPriors.forEach((p) =>
      expect(Math.abs(p - farmPriors[0]) < 1e-9).to.be(true)
    );
    expect(normalizePriors(priors, keys).every((p) => p > 0)).to.be(true);
  });

  it("softmax is normalized and stable", () => {
    const p = softmax([1000, 1001, 999]);
    expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-12).to.be(true);
    expect(p[1] > p[0] && p[0] > p[2]).to.be(true);
  });

  // A change to the vocabulary or the state encoding must not silently break
  // the models the app ships.
  BOT_DIFFICULTIES.filter((d) => d.modelFile).forEach(({ name, modelFile }) => {
    it(`loads the ${name} difficulty's model and matches its test vectors`, () => {
      const dir = path.join("weights", modelFile!);
      const shipped = readModel(path.join(dir, "model.json"));
      const tv: TestVectors = JSON.parse(
        fs.readFileSync(path.join(dir, "test_vectors.json"), "utf8")
      );
      tv.inputs.forEach((input, i) => {
        const out = shipped.forward(Float32Array.from(input));
        expect(maxAbsDiff(out.logits, tv.logits[i]) < 1e-4).to.be(true);
        expect(Math.abs(out.value - tv.value[i]) < 1e-4).to.be(true);
      });
    });
  });
});
