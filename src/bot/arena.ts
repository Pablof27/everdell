import { GameState } from "../model/gameState";
import { Player } from "../model/player";
import { GameInput, GameOptions } from "../model/types";
import { createSeededRng, withRng } from "../model/random";
import { Bot } from "./bot";
import { getLegalMoves } from "./legalMoves";

export type GameResult = {
  seed: number;
  // Indexed by seat (turn order). Ties list every tied seat.
  points: number[];
  winnerSeats: number[];
  numMoves: number;
  // Moves proposed by a bot that the engine rejected (enumerator bugs).
  numRejectedMoves: number;
  durationMs: number;
  finalState: GameState;
};

export type PlayGameOptions = {
  bots: Bot[];
  seed: number;
  gameOptions?: Partial<GameOptions>;
  maxMoves?: number;
  onRejectedMove?: (
    gameState: GameState,
    move: GameInput,
    err: unknown
  ) => void;
};

/**
 * Plays a full game between the given bots (seat i = bots[i]).
 * All engine randomness (shuffles) is driven by `seed`.
 */
export function playGame({
  bots,
  seed,
  gameOptions = {},
  maxMoves = 5000,
  onRejectedMove,
}: PlayGameOptions): GameResult {
  const start = Date.now();
  return withRng(createSeededRng(seed), () => {
    const players = bots.map(
      (bot, idx) =>
        new Player({
          name: `${bot.name} (${idx + 1})`,
          playerId: `seat-${idx}`,
          playerSecret: `seat-${idx}`,
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
    const seatByPlayerId: Record<string, number> = {};
    players.forEach((p, idx) => (seatByPlayerId[p.playerId] = idx));

    let numMoves = 0;
    let numRejectedMoves = 0;
    while (!gameState.isGameOver()) {
      if (numMoves >= maxMoves) {
        throw new Error(`Game exceeded ${maxMoves} moves (seed=${seed})`);
      }
      const bot = bots[seatByPlayerId[gameState.getActivePlayer().playerId]];
      let legalMoves = getLegalMoves(gameState);
      if (legalMoves.length === 0) {
        throw new Error(
          `No legal moves for ${bot.name} (seed=${seed}, move=${numMoves}):\n` +
            JSON.stringify(gameState.pendingGameInputs, null, 2)
        );
      }
      for (;;) {
        const move = bot.chooseMove(gameState, legalMoves);
        try {
          gameState = gameState.next(move, true, true /* skipUndo */);
          break;
        } catch (err) {
          numRejectedMoves++;
          onRejectedMove?.(gameState, move, err);
          legalMoves = legalMoves.filter((m) => m !== move);
          if (legalMoves.length === 0) {
            throw new Error(
              `Engine rejected every legal move (seed=${seed}, move=${numMoves}). ` +
                `Last error: ${(err as Error).message}`
            );
          }
        }
      }
      numMoves++;
    }

    const points = gameState.players.map((p) => p.getPoints(gameState));
    const best = Math.max(...points);
    return {
      seed,
      points,
      winnerSeats: points
        .map((p, idx) => (p === best ? idx : -1))
        .filter((idx) => idx !== -1),
      numMoves,
      numRejectedMoves,
      durationMs: Date.now() - start,
      finalState: gameState,
    };
  });
}

export type ArenaOptions = {
  bots: Bot[];
  numGames: number;
  seed?: number;
  gameOptions?: Partial<GameOptions>;
  onGameEnd?: (result: GameResult, gameIdx: number) => void;
  onRejectedMove?: PlayGameOptions["onRejectedMove"];
};

export type ArenaSummary = {
  numGames: number;
  // Indexed by bot (not seat). Ties award 1/numTied to each tied bot.
  wins: number[];
  meanPoints: number[];
  meanMoves: number;
  numRejectedMoves: number;
  durationMs: number;
};

/**
 * Plays `numGames` games, rotating seats so every bot plays every position
 * equally often. Results are reported per bot.
 */
export function runArena({
  bots,
  numGames,
  seed = 1,
  gameOptions,
  onGameEnd,
  onRejectedMove,
}: ArenaOptions): ArenaSummary {
  const start = Date.now();
  const wins = bots.map(() => 0);
  const totalPoints = bots.map(() => 0);
  let totalMoves = 0;
  let numRejectedMoves = 0;

  for (let gameIdx = 0; gameIdx < numGames; gameIdx++) {
    const offset = gameIdx % bots.length;
    // seat s is played by bot (s + offset) % n
    const seating = bots.map((_, seat) => bots[(seat + offset) % bots.length]);
    const result = playGame({
      bots: seating,
      seed: seed + gameIdx,
      gameOptions,
      onRejectedMove,
    });
    result.points.forEach((pts, seat) => {
      totalPoints[(seat + offset) % bots.length] += pts;
    });
    result.winnerSeats.forEach((seat) => {
      wins[(seat + offset) % bots.length] += 1 / result.winnerSeats.length;
    });
    totalMoves += result.numMoves;
    numRejectedMoves += result.numRejectedMoves;
    onGameEnd?.(result, gameIdx);
  }

  return {
    numGames,
    wins,
    meanPoints: totalPoints.map((p) => p / numGames),
    meanMoves: totalMoves / numGames,
    numRejectedMoves,
    durationMs: Date.now() - start,
  };
}
