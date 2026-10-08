import type { GameState } from "../model/gameState"
import { ResourceType, CardType } from "../model/types"

export const FEATURE_NAMES: string[] = [
    "points",
    "twigs",
    "resin",
    "pebbles",
    "berries",
    "handCards",
    "availableWorkers",
    "cityProductionCards",
    "cityGovernanceCards",
    "freeDestinations",
    "freeCitySpaces",
    "bestOponentsPoints"
]

export function extractFeatures(gameState: GameState, playerId: string): number[] {
    let me = gameState.getPlayer(playerId)
    let features: number[] = [
        me.getPoints(gameState),
        me.getNumResourcesByType(ResourceType.TWIG),
        me.getNumResourcesByType(ResourceType.RESIN),
        me.getNumResourcesByType(ResourceType.PEBBLE),
        me.getNumResourcesByType(ResourceType.BERRY),
        me.numCardsInHand,
        me.numAvailableWorkers,
        me.getNumCardType(CardType.PRODUCTION),
        me.getNumCardType(CardType.GOVERNANCE),
        me.getAllAvailableDestinationCards().length,
        me.maxCitySize - me.getNumOccupiedSpacesInCity(),
        Math.max(...gameState.players.filter(p => p.playerId !== playerId).map(p => p.getPoints(gameState)))
    ]

    return features
}