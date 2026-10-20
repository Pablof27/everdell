import type { NextApiRequest, NextApiResponse } from "next";
import { createGame, NewGamePlayer } from "../../model/game";
import { MAX_SEED } from "../../model/random";
import { playBotTurns } from "../../bot/botRunner";
import { resolveBotChoice } from "../../bot/botCatalog";

export default async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  // Validate game creation
  const { body } = req;
  if (!(body.players && body.players.length > 1)) {
    res.status(400).json({
      success: false,
      error: "Require at least 2 players to play!",
    });
    return;
  }
  if (!body.players.every((p: any) => !!p.name)) {
    res.status(400).json({
      success: false,
      error: "All players need to have valid names",
    });
    return;
  }
  if (body.players.every((p: any) => !!p.bot)) {
    res.status(400).json({
      success: false,
      error: "At least one player must be human",
    });
    return;
  }
  const seedInput = String(body.seed ?? "").trim();
  if (
    seedInput &&
    !(/^\d+$/.test(seedInput) && Number(seedInput) <= MAX_SEED)
  ) {
    res.status(400).json({
      success: false,
      error: `Seed must be a whole number from 0 to ${MAX_SEED}`,
    });
    return;
  }
  let players: NewGamePlayer[];
  try {
    players = body.players.map((p: any) => ({
      name: p.name,
      ...(p.bot ? resolveBotChoice(p.bot) : {}),
    }));
  } catch (e) {
    res.status(400).json({
      success: false,
      error: (e as Error).message,
    });
    return;
  }
  const realtimePoints = !!body.realtimePoints;
  const allowUndo = !!body.allowUndo;
  const chooseStartingResources = !!body.chooseStartingResources;
  const pearlbrook = !!body.pearlbrook;
  const newleaf = body.newleaf
    ? {
        cards: true,
        forestLocations: true,
        basicEvents: true,
        specialEvents: true,
        station: true,
        ticket: true,
        knoll: true,
        reserving: true,
        visitors: true,
      }
    : {};
  const bellfaire = body.bellfaire
    ? { forestLocations: true, specialEvents: true, basicEvents: true }
    : {};
  const game = await createGame(
    players,
    {
      allowUndo,
      chooseStartingResources,
      realtimePoints,
      pearlbrook,
      newleaf,
      bellfaire,
    },
    {
      seed: seedInput ? Number(seedInput) : undefined,
      randomizePlayerOrder: !!body.randomizeStartingPlayer,
    }
  );
  // A bot may have been picked as the starting player.
  try {
    await playBotTurns(game);
  } catch (e) {
    console.error(`Bot failed in game ${game.gameId}`, e);
  }
  res.json({
    success: "ok",
    gameUrl: `/game/${game.gameId}?gameSecret=${game.gameSecretUNSAFE}`,
  });
};
