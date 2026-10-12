import { GameState } from "../model/gameState"
import { PlayerStatus, Season } from "../model/types"
import { extractFeatures, FEATURE_NAMES } from "./features"

export const SEASONS: Season[] = [Season.WINTER, Season.SPRING, Season.SUMMER, Season.AUTUMN]

export type Weights = number[][]

export function evaluate(gameState: GameState, playerId: string, weights: Weights): number {
    const features = extractFeatures(gameState, playerId)
    if (gameState.isGameOver()) {
        return features[0] - features[features.length - 1] * 10
    }
    const player = gameState.getPlayer(playerId)
    let row = weights[SEASONS.indexOf(player.currentSeason)]
    if (player.getStatus() === PlayerStatus.GAME_ENDED) {
        row = row.map((w, i) => i === 0 || i === row.length - 1 ? w : 0)
    }
    return features.reduce((sum, feature, index) => sum + feature * (row[index] ?? 0), 0)
}

export function handTunedWeights(): Weights {
    const row = [
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
    return SEASONS.map(() => row.slice())
}

// Flattens to the optimizer's search vector; the points weight stays fixed at 1 in every season.
export function toFree(weights: Weights): number[] {
    return weights.reduce<number[]>((free, row) => free.concat(row.slice(1)), [])
}

export function fromFree(free: number[]): Weights {
    const k = free.length / SEASONS.length
    return SEASONS.map((_, s) => [1, ...free.slice(s * k, (s + 1) * k)])
}

export function weightsToJSON(w: Weights): {featureNames: string[]; seasons: Season[]; weights: Weights} {
    return {
        featureNames: FEATURE_NAMES,
        seasons: SEASONS,
        weights: w
    }
}

export function weightsFromJSON(json: {featureNames: string[]; seasons: Season[]; weights: Weights}): Weights {
    if (JSON.stringify(json.featureNames) !== JSON.stringify(FEATURE_NAMES)) {
        throw new Error(`Weights were saved for features [${json.featureNames}], expected [${FEATURE_NAMES}]`)
    }
    if (JSON.stringify(json.seasons) !== JSON.stringify(SEASONS)) {
        throw new Error(`Weights were saved for seasons [${json.seasons}], expected [${SEASONS}]`)
    }
    return json.weights
}