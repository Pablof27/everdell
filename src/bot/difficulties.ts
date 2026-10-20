import { BotType } from "../model/types";

export type BotDifficulty = {
  name: string;
  botType: BotType;
  // GREEDY only: weights file under weights/ (omit for the hand-tuned weights).
  weightsFile?: string;
};

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
];
