import { GameOptions } from '../model/types'
import { Weights } from './evaluations';
import { Bot } from './bot';
import { GreedyBot } from './greedyBot';
import { createSeededRng } from '../model/random';
import { playGame } from './arena';

// `points`: the candidate's own final points in every game, for tail statistics.
export type FitnessResult = { meanMargin: number; winRate: number; games: number; points: number[] }


export function evaluateWeights(
    weights: Weights,
    opts: { reference: (seat: number, seed: number) => Bot; seeds: number[]; gameOptions?: Partial<GameOptions> }
): FitnessResult {

    const games = opts.seeds.length * 2
    var meanMargin = 0
    var wins = 0
    const points: number[] = []

    for (const seed of opts.seeds) {
        const reference = opts.reference(0, seed);
        const candidate = new GreedyBot({ rng: createSeededRng(seed * 7 + 1), weights: weights })

        const result = playGame({
            bots: [reference, candidate],
            seed: seed,
        })
        const margin = result.points[1] - result.points[0]
        meanMargin += margin
        points.push(result.points[1])
        if (margin > 0) {
            wins++
        }
    }

    for (const seed of opts.seeds) {
        const reference = opts.reference(1, seed);
        const candidate = new GreedyBot({ rng: createSeededRng(seed * 7), weights: weights })

        const result = playGame({
            bots: [candidate, reference],
            seed: seed,
        })
        const margin = result.points[0] - result.points[1]
        meanMargin += margin
        points.push(result.points[0])
        if (margin > 0) {
            wins++
        }
    }

    return { meanMargin: meanMargin / games, winRate: wins / games, games: games, points: points }
}