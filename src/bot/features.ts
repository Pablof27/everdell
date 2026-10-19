import type { GameState } from "../model/gameState"
import { ResourceType, CardType } from "../model/types"
import { Card } from "../model/card"

const CARD_RESOURCES = [ResourceType.TWIG, ResourceType.RESIN, ResourceType.PEBBLE, ResourceType.BERRY] as const

// evaluate() relies on "points" being first and "bestOponentsPoints" last.
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
    "affordableHandCards",
    "usefulResources",
    "excessResources",
    "bestOponentsPoints"
]

export function extractFeatures(gameState: GameState, playerId: string): number[] {
    let me = gameState.getPlayer(playerId)
    const hand = me.getCardsInHand()
    let usefulResources = 0
    let excessResources = 0
    for (const resource of CARD_RESOURCES) {
        // Units of this resource the cards in hand could absorb; anything above it is hoarding.
        const demand = hand.reduce((sum, card) => sum + (Card.fromName(card).baseCost[resource] || 0), 0)
        const have = me.getNumResourcesByType(resource)
        usefulResources += Math.min(have, demand)
        excessResources += Math.max(0, have - demand)
    }
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
        hand.filter(card => me.canAffordCard(card, "HAND") && me.canAddToCity(card, false)).length / 2,
        usefulResources / 4,
        excessResources / 4,
        Math.max(...gameState.players.filter(p => p.playerId !== playerId).map(p => p.getPoints(gameState))) / 12
    ]

    return features
}