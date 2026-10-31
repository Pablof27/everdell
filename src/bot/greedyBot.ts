import { Bot } from "./bot"
import { getLegalMoves } from "./legalMoves"
import { determinize } from "./determinize"
import { random, Rng } from "../model/random"
import { GameState } from "../model/gameState"
import { GameInput} from "../model/types"
import { Weights, evaluate } from "./evaluations"
import cloneDeep from "lodash/cloneDeep"
import maxBy from "lodash/maxBy"

const MAX_DEPTH = 6

export class GreedyBot implements Bot {
    readonly name: string
    private rng: Rng
    private weights: Weights
    private numDeterminizations: number
    
    constructor({
        name = "Greedy",
        rng = random,
        weights,
        numDeterminizations = 3
    }: {name?: string; rng?: Rng; weights: Weights; numDeterminizations?: number}) {
        this.name = name
        this.rng = rng
        this.weights = weights
        this.numDeterminizations = numDeterminizations
    }

    chooseMove(_gameState: GameState, legalMoves: GameInput[]): GameInput {
        const scores = this.scoreMoves(_gameState, legalMoves)
        let best = -1
        let bestScore = -Infinity
        scores.forEach((score, i) => {
            if (score !== null && bestScore < score) {
                bestScore = score
                best = i
            }
        })

        return best === -1 ? legalMoves[0] : legalMoves[best]
    }

    // Evaluation of each move after resolving its follow-up inputs greedily, plus a tiny random
    // tie-breaker; null for moves the engine rejects.
    scoreMoves(_gameState: GameState, legalMoves: GameInput[]): (number | null)[] {
        const me = _gameState.getActivePlayer().playerId
        const root = determinize(_gameState, me, this.rng)

        return legalMoves.map(move => {
            let s = root
            try {
                s = root.next(cloneDeep(move), true, true)
            } catch (e) {
                console.error(e)
                return null
            }
            s = this.resolvePendingGreedily(s, me)
            return evaluate(s, me, this.weights) + this.rng() * 1e-6
        })
    }


    resolvePendingGreedily(s: GameState, me: string): GameState {
        var depth = 0

        while (!s.isGameOver() && s.pendingGameInputs.length > 0
                && s.getActivePlayer().playerId === me && depth < MAX_DEPTH) {
            const successors: GameState[] = []
            for (const option of getLegalMoves(s, { maxPerInput: 16, rng: this.rng })) {
                try {
                    successors.push(s.next(cloneDeep(option), true, true))
                } catch (e) {
                    continue
                }
            }
            const best = maxBy(successors, g => this.valueFor(g, me))
            if (!best) {
                break
            }
            s = best
            depth++
        }

        return s
    }

    valueFor(s: GameState, me: string): number {
        return evaluate(s, me, this.weights)
    }
}