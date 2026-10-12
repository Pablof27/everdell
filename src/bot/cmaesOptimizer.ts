import { Optimizer } from './optimizer';
import { createSeededRng, Rng } from '../model/random';

// Hansen's (mu/mu_w, lambda)-CMA-ES. Fitness is MINIMIZED.
export class CMAESOptimizer implements Optimizer {

    readonly name = 'CMA-ES'

    private readonly n: number
    private readonly lambda: number
    private readonly mu: number
    private readonly weights: number[]
    private readonly mueff: number
    private readonly cs: number
    private readonly ds: number
    private readonly cc: number
    private readonly c1: number
    private readonly cmu: number
    private readonly chiN: number
    private readonly rng: Rng

    private m: number[]
    private _sigma: number
    private C: number[][]
    private B: number[][]
    private D: number[]
    private ps: number[]
    private pc: number[]
    private g = 0
    private spareGaussian: number | null = null

    constructor(opts: { mean: number[]; sigma: number; lambda?: number; seed?: number }) {
        const n = opts.mean.length
        if (n === 0) {
            throw new Error('CMA-ES needs at least one dimension')
        }
        this.n = n
        this.m = opts.mean.slice()
        this._sigma = opts.sigma
        this.rng = opts.seed === undefined ? Math.random : createSeededRng(opts.seed)

        this.lambda = opts.lambda ?? 4 + Math.floor(3 * Math.log(n))
        this.mu = Math.floor(this.lambda / 2)
        const rawWeights = Array.from({ length: this.mu }, (_, i) => Math.log(this.mu + 0.5) - Math.log(i + 1))
        const sumW = rawWeights.reduce((a, b) => a + b, 0)
        this.weights = rawWeights.map((w) => w / sumW)
        this.mueff = 1 / this.weights.reduce((a, w) => a + w * w, 0)

        this.cs = (this.mueff + 2) / (n + this.mueff + 5)
        this.ds = 1 + 2 * Math.max(0, Math.sqrt((this.mueff - 1) / (n + 1)) - 1) + this.cs
        this.cc = (4 + this.mueff / n) / (n + 4 + 2 * this.mueff / n)
        this.c1 = 2 / ((n + 1.3) ** 2 + this.mueff)
        this.cmu = Math.min(1 - this.c1, (2 * (this.mueff - 2 + 1 / this.mueff)) / ((n + 2) ** 2 + this.mueff))
        this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n))

        this.C = identity(n)
        this.B = identity(n)
        this.D = new Array(n).fill(1)
        this.ps = new Array(n).fill(0)
        this.pc = new Array(n).fill(0)
    }

    get mean(): number[] {
        return this.m.slice()
    }

    get sigma(): number {
        return this._sigma
    }

    get generation(): number {
        return this.g
    }

    ask(): number[][] {
        const { n } = this
        return Array.from({ length: this.lambda }, () => {
            const dz = Array.from({ length: n }, (_, j) => this.D[j] * this.gaussian())
            const y = matVec(this.B, dz)
            return this.m.map((mj, j) => mj + this._sigma * y[j])
        })
    }

    tell(candidates: number[][], fitness: number[]): void {
        const { n, mu, weights, cs, cc, c1, cmu } = this
        if (candidates.length !== fitness.length || candidates.length < mu) {
            throw new Error(`Expected at least ${mu} candidates with one fitness each`)
        }

        const order = fitness.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f)
        const ys = order.slice(0, mu).map(({ i }) => candidates[i].map((x, j) => (x - this.m[j]) / this._sigma))

        const yw = new Array(n).fill(0)
        ys.forEach((y, k) => y.forEach((v, j) => { yw[j] += weights[k] * v }))
        this.m = this.m.map((mj, j) => mj + this._sigma * yw[j])

        // C^{-1/2} y_w = B diag(1/D) B^T y_w
        const btyw = matTVec(this.B, yw)
        const invSqrtCyw = matVec(this.B, btyw.map((v, j) => v / this.D[j]))
        const csFactor = Math.sqrt(cs * (2 - cs) * this.mueff)
        this.ps = this.ps.map((p, j) => (1 - cs) * p + csFactor * invSqrtCyw[j])

        const psNorm = norm(this.ps)
        const hsig = psNorm / Math.sqrt(1 - (1 - cs) ** (2 * (this.g + 1))) < (1.4 + 2 / (n + 1)) * this.chiN ? 1 : 0

        const ccFactor = hsig * Math.sqrt(cc * (2 - cc) * this.mueff)
        this.pc = this.pc.map((p, j) => (1 - cc) * p + ccFactor * yw[j])

        const oldScale = 1 - c1 - cmu + c1 * (1 - hsig) * cc * (2 - cc)
        for (let r = 0; r < n; r++) {
            for (let c = 0; c <= r; c++) {
                let rankMu = 0
                for (let k = 0; k < mu; k++) {
                    rankMu += weights[k] * ys[k][r] * ys[k][c]
                }
                const v = oldScale * this.C[r][c] + c1 * this.pc[r] * this.pc[c] + cmu * rankMu
                this.C[r][c] = v
                this.C[c][r] = v
            }
        }

        this._sigma *= Math.exp((this.cs / this.ds) * (psNorm / this.chiN - 1))

        const { values, vectors } = symmetricEigen(this.C)
        this.B = vectors
        this.D = values.map((v) => Math.sqrt(Math.max(v, 1e-20)))

        this.g++
    }

    // Box-Muller, caching the second sample.
    private gaussian(): number {
        if (this.spareGaussian !== null) {
            const s = this.spareGaussian
            this.spareGaussian = null
            return s
        }
        let u = 0
        while (u === 0) u = this.rng()
        const v = this.rng()
        const r = Math.sqrt(-2 * Math.log(u))
        this.spareGaussian = r * Math.sin(2 * Math.PI * v)
        return r * Math.cos(2 * Math.PI * v)
    }
}

function identity(n: number): number[][] {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
}

function matVec(A: number[][], x: number[]): number[] {
    return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0))
}

function matTVec(A: number[][], x: number[]): number[] {
    const out = new Array(A[0].length).fill(0)
    A.forEach((row, i) => row.forEach((a, j) => { out[j] += a * x[i] }))
    return out
}

function norm(x: number[]): number {
    return Math.sqrt(x.reduce((s, v) => s + v * v, 0))
}

// Cyclic Jacobi eigen-decomposition of a symmetric matrix; eigenvectors are the columns of `vectors`.
function symmetricEigen(matrix: number[][]): { values: number[]; vectors: number[][] } {
    const n = matrix.length
    const a = matrix.map((row) => row.slice())
    const v = identity(n)

    for (let sweep = 0; sweep < 100; sweep++) {
        let off = 0
        let diag = 0
        for (let p = 0; p < n; p++) {
            diag += a[p][p] * a[p][p]
            for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q]
        }
        if (off <= 1e-30 * diag) break

        for (let p = 0; p < n - 1; p++) {
            for (let q = p + 1; q < n; q++) {
                const apq = a[p][q]
                if (apq === 0) continue
                const theta = (a[q][q] - a[p][p]) / (2 * apq)
                const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
                const c = 1 / Math.sqrt(t * t + 1)
                const s = t * c
                for (let k = 0; k < n; k++) {
                    const akp = a[k][p]
                    const akq = a[k][q]
                    a[k][p] = c * akp - s * akq
                    a[k][q] = s * akp + c * akq
                }
                for (let k = 0; k < n; k++) {
                    const apk = a[p][k]
                    const aqk = a[q][k]
                    a[p][k] = c * apk - s * aqk
                    a[q][k] = s * apk + c * aqk
                }
                for (let k = 0; k < n; k++) {
                    const vkp = v[k][p]
                    const vkq = v[k][q]
                    v[k][p] = c * vkp - s * vkq
                    v[k][q] = s * vkp + c * vkq
                }
            }
        }
    }

    return { values: a.map((row, i) => row[i]), vectors: v }
}