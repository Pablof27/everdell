import { BotConfig, BotType } from "../model/types";

export type BotDifficulty = {
  name: string;
  botType: BotType;
  // GREEDY / MCTS_V: weights file under weights/ (omit for the hand-tuned weights).
  weightsFile?: string;
  // AZ: model directory under weights/.
  modelFile?: string;
} & Pick<BotConfig, "simulations" | "determinizations">;

// The bot behind each difficulty of the game builder, easiest first. Point a
// difficulty at a newly trained bot here; games already created keep theirs.
export const BOT_DIFFICULTIES: BotDifficulty[] = [
  { name: "Easy", botType: "RANDOM" },
  {
    name: "Medium",
    botType: "GREEDY",
    weightsFile: "run1/greedy-evolved.json",
  },
  {
    name: "Hard",
    botType: "GREEDY",
    weightsFile: "run4/greedy-evolved.json",
  },
  // AlphaZero-style search (az-loop run1, generation 3): ~0.3 s per move.
  {
    name: "Expert",
    botType: "AZ",
    modelFile: "az/expert",
    simulations: 400,
    determinizations: 3,
  },
];
