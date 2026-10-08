import { GameState } from "../model/gameState"
import { extractFeatures, FEATURE_NAMES } from "./features"

export type Weights = number[]

export function evaluate(gameState: GameState, playerId: string, weights: Weights): number {
    const features = extractFeatures(gameState, playerId)
    return features.reduce((sum, feature, index) => sum + feature * (weights[index] ?? 0), 0)
}

export function handTunedWeights(): Weights {
    return [
        10, // points
        1,  // twigs
        2,  // resin
        2,  // pebbles
        1,  // berries
        5,  // handCards
        3,  // availableWorkers
        2,  // cityProductionCards
        2,  // cityGovernanceCards
        4,  // freeDestinations
        4,  // freeCitySpaces
        8   // bestOponentsPoints
    ]
}

export function weightsToJSON(w: Weights): {featureNames: string[]; weights: Weights} {
    return {
        featureNames: FEATURE_NAMES,
        weights: w
    }
}

export function weightsFromJSON(json: {featureNames: string[]; weights: Weights}): Weights {
    return json.weights
}