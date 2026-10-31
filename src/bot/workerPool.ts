// Runs jobs in forked child processes (one job per worker at a time).
// The child calls serveJobs(handler) with the synchronous job handler.
import { ChildProcess, fork } from "child_process";

type JobMessage<J> = { id: number; job: J };
type ReplyMessage<R> =
  | { id: number; result: R }
  | { id: number; error: string };

type Pending<R> = { resolve: (r: R) => void; reject: (e: Error) => void };

export class WorkerPool<J, R> {
  private readonly script: string;
  private workers: ChildProcess[] = [];
  private idle: ChildProcess[] = [];
  private readonly queue: { job: J; pending: Pending<R> }[] = [];
  private readonly running = new Map<ChildProcess, number>();
  private readonly pending = new Map<number, Pending<R>>();
  private nextId = 0;
  private closed = false;

  constructor(script: string, size: number) {
    this.script = script;
    for (let i = 0; i < size; i++) {
      this.spawn();
    }
  }

  get size(): number {
    return this.workers.length;
  }

  run(job: J): Promise<R> {
    if (this.closed) {
      return Promise.reject(new Error("The worker pool is closed"));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ job, pending: { resolve, reject } });
      this.dispatch();
    });
  }

  close(): void {
    this.closed = true;
    this.workers.forEach((w) => w.connected && w.disconnect());
  }

  private spawn(): void {
    const worker = fork(this.script, [], {
      execArgv: ["-r", "ts-eager/register"],
    });
    worker.on("message", (reply: ReplyMessage<R>) => {
      const job = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      this.running.delete(worker);
      this.idle.push(worker);
      if (job) {
        if ("error" in reply) {
          job.reject(new Error(reply.error));
        } else {
          job.resolve(reply.result);
        }
      }
      this.dispatch();
    });
    worker.on("exit", (code) => {
      this.workers = this.workers.filter((w) => w !== worker);
      this.idle = this.idle.filter((w) => w !== worker);
      const id = this.running.get(worker);
      this.running.delete(worker);
      if (this.closed) {
        return;
      }
      // Fails the job it was running and replaces it.
      if (id !== undefined) {
        this.pending.get(id)?.reject(new Error(`Worker exited (code ${code})`));
        this.pending.delete(id);
      }
      console.error(`Worker exited unexpectedly (code ${code}), restarting it`);
      this.spawn();
      this.dispatch();
    });
    this.workers.push(worker);
    this.idle.push(worker);
  }

  private dispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const { job, pending } = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, pending);
      this.running.set(worker, id);
      const message: JobMessage<J> = { id, job };
      worker.send(message);
    }
  }
}

// In the child process: answers every job with handler(job).
export function serveJobs<J, R>(handler: (job: J) => R): void {
  process.on("message", (message: JobMessage<J>) => {
    let reply: ReplyMessage<R>;
    try {
      reply = { id: message.id, result: handler(message.job) };
    } catch (err) {
      reply = { id: message.id, error: String((err as Error).stack || err) };
    }
    // The callback swallows EPIPE when the parent has already exited.
    process.send!(reply, () => undefined);
  });
  process.on("disconnect", () => process.exit(0));
}
