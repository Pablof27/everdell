
export interface Optimizer {
    readonly name: string

    ask(): number[][]
    tell(candidates: number[][], fitness: number[]): void
}