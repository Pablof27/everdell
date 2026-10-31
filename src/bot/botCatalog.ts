// Server-only: the bots a new game can seat, loaded from weights/.
import fs from "fs";
import path from "path";
import { BOT_TYPES, BotConfig, BotType } from "../model/types";
import { BOT_DIFFICULTIES } from "./difficulties";
import { Weights, weightsFromJSON } from "./evaluations";
import type { CreateBotOptions } from "./bot";
import { isModelManifest, loadModel } from "./modelFiles";
import { ACTION_KEYS } from "./actionKey";

const WEIGHTS_DIR = path.join(process.cwd(), "weights");

// A difficulty, or an explicit strategy (GREEDY / MCTS_V may name a weights
// file, AZ must name a model).
export type BotChoice =
  | { difficulty: string }
  | { botType: BotType; weightsFile?: string; modelFile?: string };

export type BotOptions = {
  difficulties: string[];
  weightsFiles: string[];
  modelFiles: string[];
};

export type ResolvedBot = {
  botType: BotType;
  botWeights: Weights | null;
  botConfig: BotConfig | null;
};

// The arena page builds its bots in the browser, so it gets them resolved
// (models are fetched from /api/bot-model).
export type ArenaBotOptions = {
  difficulties: { name: string; bot: ResolvedBot }[];
  weightsFiles: { file: string; weights: Weights }[];
  modelFiles: string[];
};

export function getBotOptions(): BotOptions {
  return {
    difficulties: BOT_DIFFICULTIES.map((d) => d.name),
    weightsFiles: listWeightsFiles(),
    modelFiles: listModelFiles(),
  };
}

export function getArenaBotOptions(): ArenaBotOptions {
  return {
    difficulties: BOT_DIFFICULTIES.map(({ name }) => ({
      name,
      bot: resolveBotChoice({ difficulty: name }),
    })),
    weightsFiles: listWeightsFiles().map((file) => ({
      file,
      weights: readWeights(file) as Weights,
    })),
    modelFiles: listModelFiles(),
  };
}

// Files of AZ models and az-loop runs: never weights, and some are large.
const AZ_FILES = [
  "model.json",
  "test_vectors.json",
  "metrics.json",
  "state.json",
];

// Loadable weights files (paths relative to weights/). Skips evolve
// checkpoints, which hold optimizer state.
export function listWeightsFiles(): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    fs.readdirSync(path.join(WEIGHTS_DIR, dir), {
      withFileTypes: true,
    }).forEach((entry) => {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && entry.name !== "checkpoints") {
        visit(file);
      } else if (
        entry.name.endsWith(".json") &&
        !AZ_FILES.includes(entry.name) &&
        readWeights(file)
      ) {
        files.push(file);
      }
    });
  };
  if (fs.existsSync(WEIGHTS_DIR)) {
    visit("");
  }
  return files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function readWeights(file: string): Weights | null {
  try {
    return weightsFromJSON(
      JSON.parse(fs.readFileSync(path.join(WEIGHTS_DIR, file), "utf8"))
    );
  } catch (e) {
    return null;
  }
}

// Only listed weights files and models are read, so client input can't reach
// other paths.
export function resolveBotChoice(choice: BotChoice): ResolvedBot {
  if ("difficulty" in choice) {
    const { difficulty } = choice;
    const config = BOT_DIFFICULTIES.find((d) => d.name === difficulty);
    if (!config) {
      throw new Error(`Unknown bot difficulty: ${difficulty}`);
    }
    const {
      botType,
      weightsFile,
      modelFile,
      simulations,
      determinizations,
    } = config;
    const bot = resolveBotChoice({ botType, weightsFile, modelFile });
    if (simulations !== undefined || determinizations !== undefined) {
      bot.botConfig = { ...bot.botConfig, simulations, determinizations };
    }
    return bot;
  }
  const { botType, weightsFile, modelFile } = choice;
  if (!(BOT_TYPES as readonly string[]).includes(botType)) {
    throw new Error(`Unknown bot strategy: ${botType}`);
  }
  if (botType === "AZ") {
    if (!modelFile || !listModelFiles().includes(modelFile)) {
      throw new Error(`No usable AZ model at weights/${modelFile}`);
    }
    return { botType, botWeights: null, botConfig: { modelFile } };
  }
  if ((botType !== "GREEDY" && botType !== "MCTS_V") || !weightsFile) {
    return { botType, botWeights: null, botConfig: null };
  }
  const botWeights =
    listWeightsFiles().includes(weightsFile) && readWeights(weightsFile);
  if (!botWeights) {
    throw new Error(`No usable weights file at weights/${weightsFile}`);
  }
  return { botType, botWeights, botConfig: null };
}

// AZ models: directories under weights/ holding a model.json for the current
// action vocabulary. Skips the per-generation candidates of az-loop runs.
export function listModelFiles(): string[] {
  const dirs: string[] = [];
  const visit = (dir: string) => {
    const abs = path.join(WEIGHTS_DIR, dir);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    if (
      entries.some((e) => e.name === "model.json") &&
      isUsableModel(path.join(abs, "model.json"))
    ) {
      dirs.push(dir);
    }
    entries.forEach((entry) => {
      if (
        entry.isDirectory() &&
        entry.name !== "checkpoints" &&
        !/^gen-\d+$/.test(entry.name)
      ) {
        visit(dir ? `${dir}/${entry.name}` : entry.name);
      }
    });
  };
  if (fs.existsSync(WEIGHTS_DIR)) {
    visit("");
  }
  return dirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function isUsableModel(manifestFile: string): boolean {
  try {
    const json = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    return (
      isModelManifest(json) &&
      json.keys.length === ACTION_KEYS.length &&
      json.keys.every((k, i) => k === ACTION_KEYS[i])
    );
  } catch (e) {
    return false;
  }
}

export function modelManifestFile(modelFile: string): string {
  return path.join(
    WEIGHTS_DIR,
    modelFile.endsWith(".json") ? modelFile : path.join(modelFile, "model.json")
  );
}

// Options of createBot for a stored bot config (loads the AZ model).
export function botConfigOptions(
  config: BotConfig | null | undefined
): Partial<CreateBotOptions> {
  if (!config) {
    return {};
  }
  return {
    simulations: config.simulations,
    determinizations: config.determinizations,
    model: config.modelFile
      ? loadModel(modelManifestFile(config.modelFile))
      : undefined,
  };
}

// The number of players an AZ bot's model was trained for (null: no model).
export function botModelNumPlayers(
  config: BotConfig | null | undefined
): number | null {
  return config?.modelFile
    ? loadModel(modelManifestFile(config.modelFile)).numPlayers
    : null;
}
