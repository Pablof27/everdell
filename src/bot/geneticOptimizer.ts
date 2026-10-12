import { Optimizer } from './optimizer'
import { sample } from '../model/random'
import random from 'random'

export class GeneticOptimizer implements Optimizer {
    readonly name: string = 'GeneticOptimizer'
    private readonly _n: number
    private population: number[][]
    private readonly _alpha: number

    constructor(opts: {
        populationSize: number;
        alpha?: number;
    }) {
        this._n = opts.populationSize
        this.population = []
        this._alpha = opts.alpha ?? 0.5
    }
    ask(): number[][] {
        return this.population
    }
    tell(candidates: number[][], fitness: number[]): void {
        this.population = fitness
            .map((fit, idx) => ({ fit, idx }))
            .sort((a, b) => b.fit - a.fit)
            .slice(0, 2)
            .map((item) => candidates[item.idx])

        const mutationRate = 1 / candidates[0].length
        const gaussianGen = random.normal(0, 0.1)

        for (let i = 2; i < this._n; i++) {

            const parent1 = Array.from(
                { length: 3 },
                () => sample(
                    fitness.map((fit, idx) => ({ candidate: candidates[idx], fit })),
                )
            ).reduce((best, current) => (current.fit > best.fit ? current : best)).candidate

            const parent2 = Array.from(
                { length: 3 },
                () => sample(
                    fitness.map((fit, idx) => ({ candidate: candidates[idx], fit })),
                )
            ).reduce((best, current) => (current.fit > best.fit ? current : best)).candidate

            const child = parent1.map((gene, idx) => {
                const genes = gene < parent2[idx] ? [gene, parent2[idx]] : [parent2[idx], gene]
                const d = genes[1] - genes[0] * this._alpha
                const newGene = Math.random() * d * (1/this._alpha + 2) + genes[0] - d
                if (Math.random() < mutationRate) {
                    return newGene + gaussianGen()
                }
                return newGene
            })
            this.population.push(child)
        }
    }

}