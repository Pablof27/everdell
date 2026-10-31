// Server-only: bots described by plain, serializable specs, as written on the
// command line: TYPE[:arg]... where an arg is key=value or a file.
//
//   RANDOM
//   GREEDY:weights/run4/greedy-evolved.json
//   MCTS_V:weights/run4/greedy-evolved.json:sims=200:k=1:temp=1.67
//   AZ:weights/az/run1/best:sims=200:k=3
//
// Keys: sims (simulations per search), k (determinizations), cpuct, temp
// (MCTS_V value temperature), vmode (MCTS_V value: diff, self, root or zero;
// see LinearValueMode), resolve (MCTS_V: 1 resolves pending sub-inputs greedily
// at the leaves), priors (MCTS_V: none, pending or all; 1-ply greedy priors)
// and ptemp (their temperature), name. The file is the weights of
// GREEDY/MCTS_V or the model of AZ (a manifest, or a directory holding
// model.json).
import fs from "fs";
import path from "path";
import { BOT_TYPES, BotType } from "../model/types";
import { Rng } from "../model/random";
import { Bot, createBot } from "./bot";
import { Weights, weightsFromJSON } from "./evaluations";
import { LinearValueMode } from "./everdellGame";
import { loadModel } from "./modelFiles";

export type BotSpec = {
  botType: BotType;
  name?: string;
  // GREEDY and MCTS_V evaluation weights.
  weightsFile?: string;
  // AZ model.
  modelFile?: string;
  simulations?: number;
  determinizations?: number;
  cPuct?: number;
  valueTemperature?: number;
  valueMode?: LinearValueMode;
  resolvePending?: boolean;
  greedyPriors?: "none" | "pending" | "all";
  priorTemperature?: number;
};

const NUMERIC_KEYS: Record<string, keyof BotSpec> = {
  sims: "simulations",
  k: "determinizations",
  cpuct: "cPuct",
  temp: "valueTemperature",
  ptemp: "priorTemperature",
};

const PRIOR_MODES = ["none", "pending", "all"] as const;

const VALUE_MODES: Record<string, LinearValueMode> = {
  diff: "difference",
  self: "selfDifference",
  root: "rootPlayer",
  zero: "zero",
};

export function parseBotSpec(text: string): BotSpec {
  const [type, ...args] = text.split(":");
  if (!(BOT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unknown bot type ${type} in ${text}`);
  }
  const spec: BotSpec = { botType: type as BotType };
  args.forEach((arg) => {
    const eq = arg.indexOf("=");
    if (eq === -1) {
      if (spec.botType === "AZ") {
        spec.modelFile = arg;
      } else {
        spec.weightsFile = arg;
      }
      return;
    }
    const key = arg.slice(0, eq);
    const value = arg.slice(eq + 1);
    if (key === "name") {
      spec.name = value;
    } else if (key === "vmode" && VALUE_MODES[value]) {
      spec.valueMode = VALUE_MODES[value];
    } else if (
      key === "priors" &&
      (PRIOR_MODES as readonly string[]).includes(value)
    ) {
      spec.greedyPriors = value as BotSpec["greedyPriors"];
    } else if (key === "resolve") {
      spec.resolvePending = value === "1" || value === "true";
    } else if (NUMERIC_KEYS[key]) {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(`Bad number in ${text}: ${arg}`);
      }
      (spec as Record<string, unknown>)[NUMERIC_KEYS[key]] = num;
    } else {
      throw new Error(`Unknown bot option ${key} in ${text}`);
    }
  });
  if (spec.botType === "AZ" && !spec.modelFile) {
    throw new Error(`AZ needs a model: AZ:<model.json or directory>`);
  }
  return spec;
}

export function formatBotSpec(spec: BotSpec): string {
  const parts: string[] = [spec.botType];
  if (spec.weightsFile) {
    parts.push(spec.weightsFile);
  }
  if (spec.modelFile) {
    parts.push(spec.modelFile);
  }
  Object.entries(NUMERIC_KEYS).forEach(([key, field]) => {
    if (spec[field] !== undefined) {
      parts.push(`${key}=${spec[field]}`);
    }
  });
  Object.entries(VALUE_MODES).forEach(([key, mode]) => {
    if (spec.valueMode === mode) {
      parts.push(`vmode=${key}`);
    }
  });
  if (spec.resolvePending !== undefined) {
    parts.push(`resolve=${spec.resolvePending ? 1 : 0}`);
  }
  if (spec.greedyPriors !== undefined) {
    parts.push(`priors=${spec.greedyPriors}`);
  }
  return parts.join(":");
}

export function modelManifestPath(file: string): string {
  return fs.existsSync(file) && fs.statSync(file).isDirectory()
    ? path.join(file, "model.json")
    : file;
}

const weightsCache = new Map<string, Weights>();

export function loadWeights(file: string): Weights {
  const key = path.resolve(file);
  if (!weightsCache.has(key)) {
    weightsCache.set(
      key,
      weightsFromJSON(JSON.parse(fs.readFileSync(key, "utf8")))
    );
  }
  return weightsCache.get(key)!;
}

export function botFromSpec(spec: BotSpec, rng: Rng): Bot {
  return createBot(spec.botType, {
    name: spec.name,
    rng,
    weights: spec.weightsFile ? loadWeights(spec.weightsFile) : undefined,
    model: spec.modelFile
      ? loadModel(modelManifestPath(spec.modelFile))
      : undefined,
    simulations: spec.simulations,
    determinizations: spec.determinizations,
    cPuct: spec.cPuct,
    valueTemperature: spec.valueTemperature,
    valueMode: spec.valueMode,
    resolvePending: spec.resolvePending,
    greedyPriors: spec.greedyPriors,
    priorTemperature: spec.priorTemperature,
  });
}
