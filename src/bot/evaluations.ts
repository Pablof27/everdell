import { GameState } from "../model/gameState"
import { PlayerStatus } from "../model/types"
import { extractFeatures, FEATURE_NAMES } from "./features"

export type Weights = number[]

export function evaluate(gameState: GameState, playerId: string, weights: Weights): number {
    const features = extractFeatures(gameState, playerId)
    if (gameState.isGameOver()) {
        return features[0] - features[features.length - 1] * 10
    }
    const playerStatus = gameState.getPlayer(playerId).getStatus()
    if (playerStatus === PlayerStatus.GAME_ENDED) {
        weights = weights.map((w, i) => i === 0 || i === weights.length - 1 ? w : 0)
    }
    return features.reduce((sum, feature, index) => sum + feature * (weights[index] ?? 0), 0)
}

export function handTunedWeights(): Weights {
    return [
        1, // points; Fix weight
        0.7,  // twigs
        0.75,  // resin
        0.75,  // pebbles
        0.7,  // berries
        0.5,  // handCards
        0.6,  // availableWorkers
        0.75,  // cityProductionCards
        0.75,  // cityGovernanceCards
        0.2,  // freeDestinations
        0.4,  // freeCitySpaces
        -1   // bestOponentsPoints
    ]
}

function toFree(weights: Weights): Weights {
    return weights.slice(1, weights.length)
}

function fromFree(free: Weights): Weights {
    return [1, ...free]
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