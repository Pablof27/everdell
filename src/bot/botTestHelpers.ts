// Positions from seeded random play, for the bot tests.
import cloneDeep from "lodash/cloneDeep";
import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { GameInput, GameOptions } from "../model/types";
import { createSeededRng, withRng } from "../model/random";
import { getLegalMoves } from "./legalMoves";

export type RandomPosition = { gameState: GameState; legalMoves: GameInput[] };

export function randomPlayPositions({
  numGames,
  seed = 1,
  numPlayers = 2,
  gameOptions = {},
  maxPerInput = 16,
}: {
  numGames: number;
  seed?: number;
  numPlayers?: number;
  gameOptions?: Partial<GameOptions>;
  maxPerInput?: number;
}): RandomPosition[] {
  const positions: RandomPosition[] = [];
  for (let g = 0; g < numGames; g++) {
    const rng = createSeededRng(seed * 7919 + g);
    withRng(rng, () => {
      const players = Array.from(
        { length: numPlayers },
        (_, i) =>
          new Player({
            name: `P${i}`,
            playerId: `seat-${i}`,
            playerSecret: `seat-${i}`,
          })
      );
      let gameState = GameState.initialGameState({
        players,
        gameOptions: {
          realtimePoints: false,
          ...gameOptions,
          allowUndo: false,
        },
      });
      for (let moves = 0; !gameState.isGameOver() && moves < 2000; moves++) {
        const legalMoves = getLegalMoves(gameState, { maxPerInput, rng });
        positions.push({ gameState, legalMoves });
        if (legalMoves.length === 0) {
          break;
        }
        const move = legalMoves[Math.floor(rng() * legalMoves.length)];
        try {
          gameState = gameState.next(cloneDeep(move), true, true);
        } catch (e) {
          // A rare stale option: try another move from the same position.
        }
      }
    });
  }
  return positions;
}
