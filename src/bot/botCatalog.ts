// Server-only: the bots a new game can seat, loaded from weights/.
import fs from "fs";
import path from "path";
import { BOT_TYPES, BotType } from "../model/types";
import { BOT_DIFFICULTIES } from "./difficulties";
import { Weights, weightsFromJSON } from "./evaluations";

const WEIGHTS_DIR = path.join(process.cwd(), "weights");

// A difficulty, or an explicit strategy (GREEDY may name a weights file).
export type BotChoice =
  | { difficulty: string }
  | { botType: BotType; weightsFile?: string };

export type BotOptions = {
  difficulties: string[];
  weightsFiles: string[];
};

export type ResolvedBot = { botType: BotType; botWeights: Weights | null };

// The arena page builds its bots in the browser, so it gets them resolved.
export type ArenaBotOptions = {
  difficulties: { name: string; bot: ResolvedBot }[];
  weightsFiles: { file: string; weights: Weights }[];
};

export function getBotOptions(): BotOptions {
  return {
    difficulties: BOT_DIFFICULTIES.map((d) => d.name),
    weightsFiles: listWeightsFiles(),
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
  };
}

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
      } else if (entry.name.endsWith(".json") && readWeights(file)) {
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

// Only listed weights files are read, so client input can't reach other paths.
export function resolveBotChoice(choice: BotChoice): ResolvedBot {
  if ("difficulty" in choice) {
    const { difficulty } = choice;
    const config = BOT_DIFFICULTIES.find((d) => d.name === difficulty);
    if (!config) {
      throw new Error(`Unknown bot difficulty: ${difficulty}`);
    }
    return resolveBotChoice(config);
  }
  const { botType, weightsFile } = choice;
  if (!(BOT_TYPES as readonly string[]).includes(botType)) {
    throw new Error(`Unknown bot strategy: ${botType}`);
  }
  if (botType !== "GREEDY" || !weightsFile) {
    return { botType, botWeights: null };
  }
  const botWeights =
    listWeightsFiles().includes(weightsFile) && readWeights(weightsFile);
  if (!botWeights) {
    throw new Error(`No usable weights file at weights/${weightsFile}`);
  }
  return { botType, botWeights };
}
