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
        me.getPoints(gameState) / 12,
        me.getNumResourcesByType(ResourceType.TWIG) / 2,
        me.getNumResourcesByType(ResourceType.RESIN) / 2,
        me.getNumResourcesByType(ResourceType.PEBBLE) / 2,
        me.getNumResourcesByType(ResourceType.BERRY) / 2,
        me.numCardsInHand / 8 * 3,
        me.numAvailableWorkers / 2,
        me.getNumCardType(CardType.PRODUCTION) / 2,
        me.getNumCardType(CardType.GOVERNANCE) / 2,
        me.getAllAvailableDestinationCards().length / 3,
        (me.maxCitySize - me.getNumOccupiedSpacesInCity()) / 4,
        Math.max(...gameState.players.filter(p => p.playerId !== playerId).map(p => p.getPoints(gameState))) / 12
    ]

    return features
}