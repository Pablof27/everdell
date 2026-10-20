import { Game } from "../model/game";
import { createBot } from "./bot";
import { getLegalMoves } from "./legalMoves";

// Safety net against a bot that never ends its turn.
const MAX_BOT_MOVES_PER_CALL = 500;

// Games whose bot turns are currently being played by this process.
const inProgress = new Set<string>();

/**
 * Plays every consecutive bot turn from the game's current state, saving
 * after each accepted move. Returns once a human is the active player or the
 * game is over. Concurrent calls for the same game are ignored.
 */
export async function playBotTurns(game: Game): Promise<number> {
  if (inProgress.has(game.gameId)) {
    return 0;
  }
  inProgress.add(game.gameId);
  try {
    let numMoves = 0;
    while (!game.isGameOver()) {
      const player = game.getActivePlayer();
      const botType = player.botType;
      if (!botType) {
        break;
      }
      if (numMoves >= MAX_BOT_MOVES_PER_CALL) {
        throw new Error(
          `Bot ${player.name} exceeded ${MAX_BOT_MOVES_PER_CALL} moves`
        );
      }
      const gameState = game.getGameState();
      game.withGameRng("bot", (rng) => {
        const bot = createBot(botType, {
          rng,
          weights: game.getBotWeights(player.playerId),
        });
        let legalMoves = getLegalMoves(gameState, { rng });
        if (legalMoves.length === 0) {
          throw new Error(`No legal moves for bot ${player.name}`);
        }
        for (;;) {
          const move = bot.chooseMove(gameState, legalMoves);
          try {
            game.applyGameInput(move);
            break;
          } catch (err) {
            console.warn(
              `Bot move rejected (${(err as Error).message.split("\n")[0]}): ` +
                JSON.stringify(move)
            );
            legalMoves = legalMoves.filter((m) => m !== move);
            if (legalMoves.length === 0) {
              throw err;
            }
          }
        }
      });
      await game.save();
      numMoves++;
    }
    return numMoves;
  } finally {
    inProgress.delete(game.gameId);
  }
}
