import { GameState } from "../model/gameState";
import { Rng, random, shuffle } from "../model/random";

/**
 * Returns a copy of `gameState` where everything `viewerPlayerId` cannot see
 * is re-sampled: opponents' hands and the deck are pooled and re-dealt
 * (preserving hand sizes), likewise opponents' adornments (Pearlbrook).
 * Public information is untouched.
 *
 * Bots running on the server hold the full private state, so they must
 * search on determinized copies rather than the real state.
 *
 * Not yet hidden: the order of the Newleaf visitor / train car tile stacks,
 * and cards the viewer could infer (eg. ones they handed to an opponent).
 */
export function determinize(
  gameState: GameState,
  viewerPlayerId: string,
  rng: Rng = random
): GameState {
  const json = gameState.toJSON({ includePrivate: true, isRoot: false });
  const opponents = json.players.filter((p) => p.playerId !== viewerPlayerId);

  const cardPool = [...json.deck.cards];
  opponents.forEach((p) => cardPool.push(...(p.cardsInHand || [])));
  const cards = shuffle(cardPool, rng);
  let idx = 0;
  opponents.forEach((p) => {
    p.cardsInHand = cards.slice(idx, idx + p.numCardsInHand);
    idx += p.numCardsInHand;
  });
  json.deck.cards = cards.slice(idx);
  json.deck.numCards = json.deck.cards.length;

  if (json.adornmentsPile) {
    const adornmentPool = [...json.adornmentsPile.cards];
    opponents.forEach((p) => adornmentPool.push(...p.adornmentsInHand));
    const adornments = shuffle(adornmentPool, rng);
    let adornmentIdx = 0;
    opponents.forEach((p) => {
      p.adornmentsInHand = adornments.slice(
        adornmentIdx,
        adornmentIdx + p.numAdornmentsInHand
      );
      adornmentIdx += p.numAdornmentsInHand;
    });
    json.adornmentsPile.cards = adornments.slice(adornmentIdx);
    json.adornmentsPile.numCards = json.adornmentsPile.cards.length;
  }

  return GameState.fromJSON(json);
}
