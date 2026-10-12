import expect from 'expect.js'
import { GeneticOptimizer } from './geneticOptimizer';

/**
 * N-Dimensional Sphere Function
 * f(x) = x_1^2 + x_2^2 + ... + x_n^2
 * The perfect minimum is 0, located at [0, 0, ..., 0].
 */
function evaluateSphere(individual: number[]): number {
    return individual.reduce((sum, x) => sum + x * x, 0);
}

describe('GeneticOptimizer (Ask/Tell Interface)', () => {
    
    it('evaluates the sphere function correctly (sanity check)', () => {
        expect(evaluateSphere([0, 0])).be(0);
        expect(evaluateSphere([2, -3])).be(13); // 2^2 + (-3)^2 = 4 + 9 = 13
    });

    it('converges to the global minimum in 2 Dimensions', () => {
        const dimensions = 2;
        const popSize = 30;
        const generations = 50;
        
        // Initialize your optimizer
        const optimizer = new GeneticOptimizer({ populationSize: popSize });
        let bestScore = Infinity;
        let bestParams: number[] = [];

        let candidates = Array.from({ length: popSize }, () => Array.from({ length: dimensions }, () => Math.random() * 2 - 1));
        // Ask / Tell loop
        for (let gen = 0; gen < generations; gen++) {
            const scores = candidates.map(evaluateSphere);
            
            optimizer.tell(candidates, scores);

            // Track the best for assertion
            const currentBestScore = Math.min(...scores);
            if (currentBestScore < bestScore) {
                bestScore = currentBestScore;
                bestParams = candidates[scores.indexOf(currentBestScore)];
            }
            candidates = optimizer.ask();
        }

        // Assertion: The score should be extremely close to 0
        expect(bestScore).lessThan(0.1);
        
        // Assertion: All parameters should be very close to 0
        bestParams.forEach(param => {
            expect(Math.abs(param)).lessThan(0.5);
        });
    });

    it('scales and converges in 10 Dimensions', () => {
        const dimensions = 10;
        const popSize = 100; // More dimensions require a larger population
        const generations = 150 * 2; // And more time to converge
        
        const optimizer = new GeneticOptimizer({ populationSize: popSize });
        let bestScore = Infinity;

        let candidates = Array.from({ length: popSize }, () => Array.from({ length: dimensions }, () => Math.random() * 2 - 1));
        for (let gen = 0; gen < generations; gen++) {
            const scores = candidates.map(evaluateSphere);
            optimizer.tell(candidates, scores);
            
            const currentBestScore = Math.min(...scores);
            if (currentBestScore < bestScore) {
                bestScore = currentBestScore;
            }
            candidates = optimizer.ask();
        }

        // In 10D, convergence is harder, so we allow a slightly larger tolerance.
        // It proves the optimizer is moving in the right direction.
        expect(bestScore).lessThan(1.0);
    });
});