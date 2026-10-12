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
        const me = _gameState.getActivePlayer().playerId
        let root = determinize(_gameState, me, this.rng)
        var bestMove = null
        var bestScore = -Infinity

        for (const move of legalMoves) {
            let s = root
            try {
                s = root.next(cloneDeep(move), true, true)
            } catch (e) {
                console.error(e)
                continue
            }
            s = this.resolvePendingGreedily(s, me)
            let score = evaluate(s, me, this.weights) + this.rng() * 1e-6
            if (bestScore < score) {
                bestScore = score
                bestMove = move
            }
        }

        return bestMove ?? legalMoves[0]
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