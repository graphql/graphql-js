import type { Scenario } from './fixture.ts';

export interface BenchmarkExecutionResult {
  readonly data?: unknown;
  readonly errors?: ReadonlyArray<{ readonly message: string }>;
}

export interface ExecutorRuntime {
  readonly prepare: (scenario: Scenario) => void | PromiseLike<void>;
  readonly execute: (
    scenario: Scenario,
  ) => BenchmarkExecutionResult | PromiseLike<BenchmarkExecutionResult>;
}
