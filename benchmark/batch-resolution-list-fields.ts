/* eslint-disable no-await-in-loop, no-console */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { prepareBenchmarkProjects } from '../resources/benchmark/projects.ts';
import { execute as localExecute } from '../src/execution/execute.ts';
import type { DocumentNode } from '../src/language/ast.ts';
import { parse } from '../src/language/parser.ts';
import {
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
} from '../src/type/index.ts';

import { createGrafastRuntime as createConfiguredGrafastRuntime } from './batch-resolution-setups/grafast/setup.ts';
import { createGraphQLBreadthRuntime as createConfiguredGraphQLBreadthRuntime } from './batch-resolution-setups/graphql-breadth-js/setup.ts';
import { createGraphQLJITRuntime as createConfiguredGraphQLJITRuntime } from './batch-resolution-setups/graphql-jit/setup.ts';
import type { ExecutorRuntime } from './batch-resolution-setups/shared/runtime.ts';

type MaybePromise<T> = PromiseLike<T> | T;

interface WidgetSource {
  [key: string]: unknown;
}

interface BenchContext {
  readonly loaders?: {
    readonly widget: RequestBatchLoader<WidgetSource, unknown>;
  };
}

interface FirstArgs {
  readonly first?: number | null;
}

interface Scenario {
  readonly rowLabel: string;
  readonly query: string;
  readonly document: DocumentNode;
  readonly source: WidgetSource;
  readonly expectedRootWidgetCount: number | undefined;
}

interface ExecutionResultLike {
  readonly data?: unknown;
  readonly errors?: ReadonlyArray<{ readonly message: string }>;
}

interface RuntimeModules {
  readonly execute: (args: {
    schema: unknown;
    document: unknown;
    rootValue: unknown;
    contextValue?: unknown;
    enableBatchResolvers?: true;
  }) => MaybePromise<ExecutionResultLike>;
  readonly GraphQLID: unknown;
  readonly GraphQLInt: unknown;
  readonly GraphQLList: new (type: unknown) => unknown;
  readonly GraphQLObjectType: new (config: {
    readonly [key: string]: unknown;
  }) => unknown;
  readonly GraphQLSchema: new (config: {
    readonly [key: string]: unknown;
  }) => unknown;
}

const modeOrder = [
  'graphql-js-17',
  'graphql-js-17-dataloader',
  'graphql-js-local-batch',
  'graphql-breadth-js',
  'grafast',
  'graphql-jit',
] as const;
type Mode = (typeof modeOrder)[number];

interface TimingResult {
  readonly mode: Mode;
  readonly opsPerSecond: number;
}

interface MemoryResult {
  readonly mode: Mode;
  readonly gcMsPerIteration: number;
  readonly gcCount: number;
}

interface ScenarioGroup {
  readonly title: string;
  readonly query: string;
  readonly rowHeader: string;
  readonly scenarios: ReadonlyArray<Scenario>;
}

interface ExecutorMode {
  readonly label: string;
  readonly prepare?: (scenario: Scenario) => MaybePromise<void>;
  readonly execute: (scenario: Scenario) => MaybePromise<ExecutionResultLike>;
}

const baselineRevision = process.env.BASELINE_REV ?? '17.x.x';
const options = {
  modes: envModes('MODES', modeOrder.join(',')),
  sizes: envInts('SIZES', '1,10,100,1000,10000'),
  treeListDepths: envInts('TREE_LIST_DEPTHS', '1,5'),
  treeListBreadths: envInts('TREE_LIST_BREADTHS', '10,100,1000'),
  treeDepths: envInts('TREE_DEPTHS', '1,5,10,18'),
  warmupMs: envInt('WARMUP_MS', 500),
  runMs: envInt('RUN_MS', 1500),
  timingMinRounds: envInt('TIMING_MIN_ROUNDS', 10),
  memoryIterations: envInt('MEMORY_ITERATIONS', 200),
  memoryWarmup: envInt('MEMORY_WARMUP', 50),
};

const graphQLBreadthRepoURL = 'https://github.com/gmac/graphql-breadth-js.git';
const graphQLBreadthDefaultRef = 'main';
const externalExecutorPackageVersions = {
  graphql: '16.9.0',
  graphqlJIT: '0.8.7',
  grafast: '1.0.2',
};
const localRuntime: RuntimeModules = {
  execute: localExecute as RuntimeModules['execute'],
  GraphQLID,
  GraphQLInt,
  GraphQLList: GraphQLList as RuntimeModules['GraphQLList'],
  GraphQLObjectType: GraphQLObjectType as RuntimeModules['GraphQLObjectType'],
  GraphQLSchema,
};

const multiplicationSign = 'x';

let graphqlBreadthRuntimePromise: Promise<ExecutorRuntime> | undefined;
let graphqlJITRuntimePromise: Promise<ExecutorRuntime> | undefined;
let grafastRuntimePromise: Promise<ExecutorRuntime> | undefined;

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  ensureGC();
  validateOptions();

  const baselineRuntime = await loadBaselineRuntime();
  const executors = createExecutorModes(baselineRuntime);

  console.log('Batch resolution cross-revision benchmark');
  console.log(
    [
      `baseline=${baselineRevision}`,
      `modes=${options.modes.join(',')}`,
      `sizes=${options.sizes.join(',')}`,
      `treeListDepths=${options.treeListDepths.join(',')}`,
      `treeListBreadths=${options.treeListBreadths.join(',')}`,
      `treeDepths=${options.treeDepths.join(',')}`,
      `warmup=${options.warmupMs}ms`,
      `run=${options.runMs}ms`,
      `timingMinRounds=${options.timingMinRounds}`,
      `memoryIterations=${options.memoryIterations}`,
      `memoryWarmup=${options.memoryWarmup}`,
    ].join(' '),
  );
  console.log('');
  console.log(
    'Ratios compare each speed cell to the slowest executor in its row and each GC cell to the highest observed GC time.',
  );

  for (const group of createScenarioGroups()) {
    await prepareScenarioGroup(group, executors);
    await validateScenarioGroup(group, executors);

    console.log('');
    console.log(`### ${group.title}`);
    console.log('');
    console.log('```graphql');
    console.log(group.query);
    console.log('```');
    console.log('');
    console.log('**Speed**');
    console.log('');

    const speedRows: Array<ReadonlyArray<string>> = [];
    for (const scenario of group.scenarios) {
      const timingResults = await measureTimings(executors, scenario);
      speedRows.push(speedRow(scenario, timingResults));
    }
    printMarkdownTable(group.rowHeader, speedRows);

    const memoryRows: Array<ReadonlyArray<string>> = [];
    for (const scenario of group.scenarios) {
      const memoryResults = [];
      for (const mode of options.modes) {
        memoryResults.push(
          await measureMemory(mode, executorForMode(executors, mode), scenario),
        );
      }
      if (memoryResults.some((result) => result.gcCount !== 0)) {
        memoryRows.push(memoryRow(scenario, memoryResults));
      }
    }
    if (memoryRows.length !== 0) {
      console.log('');
      console.log('**GC pressure**');
      console.log('');
      printMarkdownTable(group.rowHeader, memoryRows);
    }
  }
}

async function loadBaselineRuntime(): Promise<RuntimeModules> {
  const [project] = prepareBenchmarkProjects([baselineRevision]);
  const moduleURL = (modulePath: string) =>
    pathToFileURL(
      path.join(project.projectPath, 'node_modules/graphql', modulePath),
    ).href;

  const executionModule = (await import(
    moduleURL('execution/execute.js')
  )) as Pick<RuntimeModules, 'execute'>;
  const typeModule = (await import(moduleURL('type/index.js'))) as Omit<
    RuntimeModules,
    'execute'
  >;

  return {
    execute: executionModule.execute,
    GraphQLID: typeModule.GraphQLID,
    GraphQLInt: typeModule.GraphQLInt,
    GraphQLList: typeModule.GraphQLList,
    GraphQLObjectType: typeModule.GraphQLObjectType,
    GraphQLSchema: typeModule.GraphQLSchema,
  };
}

function createExecutorModes(
  baselineRuntime: RuntimeModules,
): ReadonlyMap<Mode, ExecutorMode> {
  return new Map<Mode, ExecutorMode>([
    [
      'graphql-js-17',
      createGraphQLJSExecutor({
        label: `${baselineRevision} regular async`,
        runtime: baselineRuntime,
        schema: createRegularAsyncSchema(baselineRuntime),
        createContext: () => ({}),
      }),
    ],
    [
      'graphql-js-17-dataloader',
      createGraphQLJSExecutor({
        label: `${baselineRevision} dataloader`,
        runtime: baselineRuntime,
        schema: createDataloaderSchema(baselineRuntime),
        createContext: createDataloaderContext,
      }),
    ],
    [
      'graphql-js-local-batch',
      createGraphQLJSExecutor({
        label: 'working tree batch',
        runtime: localRuntime,
        schema: createBatchResolverSchema(localRuntime),
        createContext: () => ({}),
        enableBatchResolvers: true,
      }),
    ],
    [
      'graphql-breadth-js',
      createExternalExecutor('graphql-breadth-js', getGraphQLBreadthRuntime),
    ],
    ['grafast', createExternalExecutor('grafast', getGrafastRuntime)],
    [
      'graphql-jit',
      createExternalExecutor('graphql-jit', getGraphQLJITRuntime),
    ],
  ]);
}

function createGraphQLJSExecutor(config: {
  readonly label: string;
  readonly runtime: RuntimeModules;
  readonly schema: unknown;
  readonly createContext: () => BenchContext;
  readonly enableBatchResolvers?: true;
}): ExecutorMode {
  return {
    label: config.label,
    execute: (scenario) =>
      config.runtime.execute({
        schema: config.schema,
        document: scenario.document,
        rootValue: scenario.source,
        contextValue: config.createContext(),
        ...(config.enableBatchResolvers === undefined
          ? {}
          : { enableBatchResolvers: config.enableBatchResolvers }),
      }),
  };
}

function createExternalExecutor(
  label: string,
  getRuntime: () => Promise<ExecutorRuntime>,
): ExecutorMode {
  return {
    label,
    prepare: async (scenario) => {
      await (await getRuntime()).prepare(scenario);
    },
    execute: async (scenario) => (await getRuntime()).execute(scenario),
  };
}

function createRegularAsyncSchema(runtime: RuntimeModules): unknown {
  return createWidgetSchema(runtime, {
    resolve: async (source: WidgetSource) => {
      await Promise.resolve();
      return source.widget;
    },
  });
}

function createDataloaderSchema(runtime: RuntimeModules): unknown {
  return createWidgetSchema(runtime, {
    resolve: (
      source: WidgetSource,
      _args: unknown,
      context: Required<BenchContext>,
    ) => context.loaders.widget.load(source),
  });
}

function createDataloaderContext(): Required<BenchContext> {
  return {
    loaders: {
      widget: new RequestBatchLoader(async (sources) => {
        await Promise.resolve();
        return sources.map((source) => source.widget);
      }),
    },
  };
}

function createBatchResolverSchema(runtime: RuntimeModules): unknown {
  return createWidgetSchema(runtime, {
    experimentalBatchResolve: async (sources: ReadonlyArray<WidgetSource>) => {
      await Promise.resolve();
      return sources.map((source) => source.widget);
    },
  });
}

function createWidgetSchema(
  runtime: RuntimeModules,
  widgetField: { readonly [key: string]: unknown },
): unknown {
  const WidgetType: unknown = new runtime.GraphQLObjectType({
    name: 'Widget',
    fields: () => ({
      id: { type: runtime.GraphQLID },
      widget: { type: WidgetType, ...widgetField },
      widgets: { type: new runtime.GraphQLList(WidgetType) },
    }),
  });

  const QueryType = new runtime.GraphQLObjectType({
    name: 'Query',
    fields: {
      widget: { type: WidgetType },
      widgets: {
        type: new runtime.GraphQLList(WidgetType),
        args: { first: { type: runtime.GraphQLInt } },
        resolve: (source: WidgetSource, args: FirstArgs) => {
          const widgets = source.widgets as ReadonlyArray<unknown>;
          return typeof args.first === 'number'
            ? widgets.slice(0, args.first)
            : widgets;
        },
      },
    },
  });

  return new runtime.GraphQLSchema({ query: QueryType });
}

function createScenarioGroups(): ReadonlyArray<ScenarioGroup> {
  return [
    {
      title: 'Flat list',
      query: 'query { widgets(first: N) { id } }',
      rowHeader: 'size',
      scenarios: options.sizes.map(createFlatListScenario),
    },
    {
      title: 'Tree within list',
      query:
        '# inner tree depth D\nquery { widgets(first: N) { widget { widget { id } id } id } }',
      rowHeader: `D ${multiplicationSign} N`,
      scenarios: options.treeListDepths.flatMap((depth) =>
        options.treeListBreadths.map((breadth) =>
          createTreeListScenario(depth, breadth),
        ),
      ),
    },
    {
      title: 'List with async widget field',
      query:
        'query { widgets(first: N) { id widget { id } } }  # N async widget resolutions',
      rowHeader: 'size',
      scenarios: options.sizes.map(createWidgetListScenario),
    },
    {
      title: 'Deep flat tree',
      query: 'query { widget { widget { widget { id } id } id } }  # depth D',
      rowHeader: 'depth',
      scenarios: options.treeDepths.map(createDeepTreeScenario),
    },
  ];
}

async function prepareScenarioGroup(
  group: ScenarioGroup,
  executors: ReadonlyMap<Mode, ExecutorMode>,
): Promise<void> {
  for (const scenario of group.scenarios) {
    for (const mode of options.modes) {
      const prepare = executorForMode(executors, mode).prepare;
      if (prepare !== undefined) {
        await prepare(scenario);
      }
    }
  }
}

async function validateScenarioGroup(
  group: ScenarioGroup,
  executors: ReadonlyMap<Mode, ExecutorMode>,
): Promise<void> {
  const baselineMode = options.modes[0];
  const baselineExecutor = executorForMode(executors, baselineMode);
  for (const scenario of group.scenarios) {
    const baseline = await runExecution(
      baselineMode,
      baselineExecutor,
      scenario,
    );
    validateScenarioResult(group, scenario, baselineExecutor, baseline);
    const baselineJSON = JSON.stringify(baseline.data);

    for (const mode of options.modes.slice(1)) {
      const executor = executorForMode(executors, mode);
      const result = await runExecution(mode, executor, scenario);
      validateScenarioResult(group, scenario, executor, result);
      const resultJSON = JSON.stringify(result.data);
      if (resultJSON !== baselineJSON) {
        throw new Error(
          `Result mismatch for ${group.title} ${scenario.rowLabel}: ` +
            `${baselineExecutor.label} != ${executor.label}`,
        );
      }
    }
  }
}

function validateScenarioResult(
  group: ScenarioGroup,
  scenario: Scenario,
  executor: ExecutorMode,
  result: ExecutionResultLike,
): void {
  const expectedRootWidgetCount = scenario.expectedRootWidgetCount;
  if (expectedRootWidgetCount === undefined) {
    return;
  }

  const widgets = (result.data as { readonly widgets: ReadonlyArray<unknown> })
    .widgets;
  if (widgets.length !== expectedRootWidgetCount) {
    throw new Error(
      `${executor.label} returned an invalid root widget count for ` +
        `${group.title} ${scenario.rowLabel}: expected ` +
        `${expectedRootWidgetCount}, got ${widgets.length}`,
    );
  }
}

async function measureTimings(
  executors: ReadonlyMap<Mode, ExecutorMode>,
  scenario: Scenario,
): Promise<Array<TimingResult>> {
  const warmupEnd = performance.now() + options.warmupMs;
  while (performance.now() < warmupEnd) {
    for (const mode of shuffled(options.modes)) {
      await runExecution(mode, executorForMode(executors, mode), scenario);
    }
  }

  forceGC();

  const timingByMode = new Map<Mode, { elapsedMs: number; iterations: number }>(
    options.modes.map((mode) => [mode, { elapsedMs: 0, iterations: 0 }]),
  );
  const benchmarkStart = performance.now();
  let rounds = 0;
  while (
    rounds < options.timingMinRounds ||
    performance.now() - benchmarkStart < options.runMs
  ) {
    for (const mode of shuffled(options.modes)) {
      const start = performance.now();
      await runExecution(mode, executorForMode(executors, mode), scenario);
      const elapsedMs = performance.now() - start;
      const timing = timingByMode.get(mode);
      if (timing === undefined) {
        throw new Error(`No timing accumulator for ${mode}.`);
      }
      timing.elapsedMs += elapsedMs;
      timing.iterations++;
    }
    rounds++;
  }

  return options.modes.map((mode) => {
    const timing = timingByMode.get(mode);
    if (timing === undefined) {
      throw new Error(`No timing accumulator for ${mode}.`);
    }

    return {
      mode,
      opsPerSecond: (timing.iterations / timing.elapsedMs) * 1000,
    };
  });
}

async function measureMemory(
  mode: Mode,
  executor: ExecutorMode,
  scenario: Scenario,
): Promise<MemoryResult> {
  for (let i = 0; i < options.memoryWarmup; i++) {
    await runExecution(mode, executor, scenario);
  }

  forceGC();
  await flushPerformanceObserver();

  const events: Array<{ duration: number }> = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      events.push({ duration: entry.duration });
    }
  });
  observer.observe({ entryTypes: ['gc'] });

  for (let i = 0; i < options.memoryIterations; i++) {
    await runExecution(mode, executor, scenario);
  }

  await flushPerformanceObserver();
  observer.disconnect();

  forceGC();

  return {
    mode,
    gcMsPerIteration:
      events.reduce((sum, event) => sum + event.duration, 0) /
      options.memoryIterations,
    gcCount: events.length,
  };
}

async function runExecution(
  mode: Mode,
  executor: ExecutorMode,
  scenario: Scenario,
): Promise<ExecutionResultLike> {
  const result = await executor.execute(scenario);

  if (result.errors !== undefined && result.errors.length !== 0) {
    throw new Error(
      `${executor.label} failed in ${mode}: ` +
        result.errors.map((error) => error.message).join('; '),
    );
  }
  return result;
}

async function getGraphQLBreadthRuntime(): Promise<ExecutorRuntime> {
  graphqlBreadthRuntimePromise ??= Promise.resolve(
    createGraphQLBreadthRuntime(),
  );
  return graphqlBreadthRuntimePromise;
}

function createGraphQLBreadthRuntime(): ExecutorRuntime {
  const rootPath = prepareGraphQLBreadthPackage();
  const revision = readGitRevision(rootPath);

  console.log(
    `Using graphql-breadth-js from ${rootPath}${revision === undefined ? '' : ` (${revision})`}`,
  );

  return createConfiguredGraphQLBreadthRuntime(rootPath);
}

function prepareGraphQLBreadthPackage(): string {
  const configuredPath = process.env.GRAPHQL_BREADTH_JS_PATH;
  const rootPath =
    configuredPath === undefined
      ? cachedGraphQLBreadthPath()
      : path.resolve(configuredPath);

  if (configuredPath === undefined) {
    const ref = process.env.GRAPHQL_BREADTH_JS_REF ?? graphQLBreadthDefaultRef;
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(path.dirname(rootPath), { recursive: true });
      runCommand(
        'git',
        ['clone', graphQLBreadthRepoURL, rootPath],
        process.cwd(),
      );
    }
    runCommand('git', ['fetch', 'origin'], rootPath);
    runCommand('git', ['checkout', ref], rootPath);
    if (ref === graphQLBreadthDefaultRef) {
      runCommand('git', ['pull', '--ff-only', 'origin', ref], rootPath);
    }
  }

  if (!fs.existsSync(path.join(rootPath, 'package.json'))) {
    throw new Error(
      `GRAPHQL_BREADTH_JS_PATH does not point at a graphql-breadth-js checkout: ${rootPath}`,
    );
  }

  if (!fs.existsSync(path.join(rootPath, 'node_modules'))) {
    runCommand('npm', ['install', '--ignore-scripts'], rootPath);
  }
  runCommand('npm', ['run', 'build'], rootPath);

  return rootPath;
}

function cachedGraphQLBreadthPath(): string {
  const ref = process.env.GRAPHQL_BREADTH_JS_REF ?? graphQLBreadthDefaultRef;
  return path.join(
    os.tmpdir(),
    'graphql-js-benchmark-graphql-breadth-js',
    ref.replaceAll(/[^a-zA-Z0-9_.-]/g, '_'),
  );
}

async function getGraphQLJITRuntime(): Promise<ExecutorRuntime> {
  graphqlJITRuntimePromise ??= Promise.resolve(
    createConfiguredGraphQLJITRuntime(prepareExternalExecutorsPackage()),
  );
  return graphqlJITRuntimePromise;
}

async function getGrafastRuntime(): Promise<ExecutorRuntime> {
  grafastRuntimePromise ??= Promise.resolve(
    createConfiguredGrafastRuntime(prepareExternalExecutorsPackage()),
  );
  return grafastRuntimePromise;
}

function prepareExternalExecutorsPackage(): string {
  const configuredPath = process.env.GRAPHQL_EXECUTOR_BENCH_DEPS_PATH;
  const rootPath =
    configuredPath === undefined
      ? path.join(os.tmpdir(), 'graphql-js-benchmark-external-executors')
      : path.resolve(configuredPath);

  fs.mkdirSync(rootPath, { recursive: true });
  const packageJSONPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(packageJSONPath)) {
    fs.writeFileSync(
      packageJSONPath,
      JSON.stringify(
        {
          private: true,
          type: 'commonjs',
          dependencies: {},
        },
        null,
        2,
      ),
    );
  }

  if (
    !fs.existsSync(path.join(rootPath, 'node_modules/graphql-jit')) ||
    !fs.existsSync(path.join(rootPath, 'node_modules/grafast'))
  ) {
    runCommand(
      'npm',
      [
        'install',
        '--ignore-scripts',
        `graphql@${externalExecutorPackageVersions.graphql}`,
        `graphql-jit@${externalExecutorPackageVersions.graphqlJIT}`,
        `grafast@${externalExecutorPackageVersions.grafast}`,
      ],
      rootPath,
    );
  }

  return rootPath;
}

function readGitRevision(rootPath: string): string | undefined {
  const result = childProcess.spawnSync(
    'git',
    ['rev-parse', '--short', 'HEAD'],
    {
      cwd: rootPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function runCommand(
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
): void {
  const result = childProcess.spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed with status ${result.status}: ${command} ${args.join(' ')}`,
    );
  }
}

function executorForMode(
  executors: ReadonlyMap<Mode, ExecutorMode>,
  mode: Mode,
): ExecutorMode {
  const executor = executors.get(mode);
  if (executor === undefined) {
    throw new Error(`No executor for mode ${mode}.`);
  }
  return executor;
}

function createFlatListScenario(size: number): Scenario {
  return createScenario(
    String(size),
    `widgets(first: ${size}) { id }`,
    createListSource(size, createWidget),
    size,
  );
}

function createWidgetListScenario(size: number): Scenario {
  return createScenario(
    String(size),
    `widgets(first: ${size}) { id widget { id } }`,
    createListSource(size, () => createWidget({ widget: createWidget() })),
    size,
  );
}

function createTreeListScenario(depth: number, breadth: number): Scenario {
  return createScenario(
    `${depth} ${multiplicationSign} ${breadth}`,
    `widgets(first: ${breadth}) { ${buildTreeQuery(depth)} }`,
    createListSource(breadth, () => createWidgetTree(depth)),
    breadth,
  );
}

function createDeepTreeScenario(depth: number): Scenario {
  return createScenario(
    String(depth),
    buildTreeQuery(depth),
    createWidgetTree(depth),
    undefined,
  );
}

function createScenario(
  rowLabel: string,
  query: string,
  source: WidgetSource,
  expectedRootWidgetCount: number | undefined,
): Scenario {
  const operation = `{ ${query} }`;
  return {
    rowLabel,
    query: operation,
    document: parse(operation),
    source,
    expectedRootWidgetCount,
  };
}

function createWidget(fields?: WidgetSource): WidgetSource {
  return { id: 'gid://owner/Widget/1', ...fields };
}

function createWidgetTree(depth: number): WidgetSource {
  assertDepth(depth);

  let source = createWidget();
  for (let i = 0; i < depth; i++) {
    source = createWidget({ widget: source });
  }

  return source;
}

function buildTreeQuery(depth: number): string {
  assertDepth(depth);

  let query = 'id';
  for (let i = 0; i < depth; i++) {
    query = `widget { ${query} id }`;
  }

  return query;
}

function createListSource(
  size: number,
  createItem: () => WidgetSource,
): WidgetSource {
  return { widgets: Array.from({ length: size + 1 }, createItem) };
}

function assertDepth(depth: number): void {
  if (depth < 0 || depth > 18) {
    throw new Error('Depth must be between 0 and 18.');
  }
}

class RequestBatchLoader<TKey, TValue> {
  private readonly loadMany: (
    keys: ReadonlyArray<TKey>,
  ) => MaybePromise<ReadonlyArray<TValue>>;

  private queue: Array<{
    key: TKey;
    resolve: (value: TValue) => void;
    reject: (reason: unknown) => void;
  }> = [];

  private scheduled = false;

  constructor(
    loadMany: (
      keys: ReadonlyArray<TKey>,
    ) => MaybePromise<ReadonlyArray<TValue>>,
  ) {
    this.loadMany = loadMany;
  }

  load(key: TKey): Promise<TValue> {
    return new Promise<TValue>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.dispatch());
      }
    });
  }

  private dispatch(): void {
    const queue = this.queue;
    this.queue = [];
    this.scheduled = false;

    let values: MaybePromise<ReadonlyArray<TValue>>;
    try {
      values = this.loadMany(queue.map((entry) => entry.key));
    } catch (error) {
      rejectAll(queue, error);
      return;
    }

    Promise.resolve(values).then(
      (resolvedValues) => {
        if (resolvedValues.length !== queue.length) {
          rejectAll(
            queue,
            new Error(
              `Batch loader returned ${resolvedValues.length} values for ${queue.length} keys.`,
            ),
          );
          return;
        }

        for (const [index, entry] of queue.entries()) {
          entry.resolve(resolvedValues[index]);
        }
      },
      (error: unknown) => rejectAll(queue, error),
    );
  }
}

function rejectAll(
  queue: ReadonlyArray<{ reject: (reason: unknown) => void }>,
  error: unknown,
): void {
  for (const entry of queue) {
    entry.reject(error);
  }
}

function validateOptions(): void {
  if (options.modes.length === 0) {
    throw new Error('MODES must include at least one executor.');
  }
  if (options.sizes.length === 0) {
    throw new Error('SIZES must include at least one size.');
  }
}

function envModes(name: string, fallback: string): Array<Mode> {
  return envList(name, fallback).map((value) => {
    if (!isMode(value)) {
      throw new Error(
        `Invalid ${name} value "${value}". Expected one of: ${modeOrder.join(
          ', ',
        )}.`,
      );
    }
    return value;
  });
}

function isMode(value: string): value is Mode {
  return modeOrder.includes(value as Mode);
}

function envInts(name: string, fallback: string): Array<number> {
  return envList(name, fallback).map((value) => parseIntEnv(name, value));
}

function envInt(name: string, fallback: number): number {
  return parseIntEnv(name, process.env[name] ?? String(fallback));
}

function parseIntEnv(name: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value) {
    throw new Error(`${name} must contain integer values, got "${value}".`);
  }
  return parsed;
}

function envList(name: string, fallback: string): Array<string> {
  return (process.env[name] ?? fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function speedRow(
  scenario: Scenario,
  results: ReadonlyArray<TimingResult>,
): ReadonlyArray<string> {
  const slowest = results.reduce<TimingResult | undefined>(
    (best, result) =>
      best === undefined || result.opsPerSecond < best.opsPerSecond
        ? result
        : best,
    undefined,
  );

  return [
    scenario.rowLabel,
    ...options.modes.map((mode) => {
      const result = results.find((candidate) => candidate.mode === mode);
      if (result === undefined) {
        return '-';
      }

      return formatMetricWithRatio(
        formatIterationsPerSecond(result.opsPerSecond),
        slowest === undefined || slowest.opsPerSecond === 0
          ? undefined
          : result.opsPerSecond / slowest.opsPerSecond,
      );
    }),
  ];
}

function memoryRow(
  scenario: Scenario,
  results: ReadonlyArray<MemoryResult>,
): ReadonlyArray<string> {
  const highest = results.reduce<MemoryResult | undefined>((best, result) => {
    if (result.gcCount === 0 || result.gcMsPerIteration === 0) {
      return best;
    }
    return best === undefined || result.gcMsPerIteration > best.gcMsPerIteration
      ? result
      : best;
  }, undefined);

  return [
    scenario.rowLabel,
    ...options.modes.map((mode) => {
      const result = results.find((candidate) => candidate.mode === mode);
      if (
        result === undefined ||
        result.gcCount === 0 ||
        result.gcMsPerIteration === 0
      ) {
        return '-';
      }

      return formatMetricWithRatio(
        formatMicroseconds(result.gcMsPerIteration),
        highest === undefined
          ? undefined
          : highest.gcMsPerIteration / result.gcMsPerIteration,
      );
    }),
  ];
}

function formatMetricWithRatio(
  metric: string,
  ratio: number | undefined,
): string {
  return ratio === undefined ? metric : `${metric} (${formatRatio(ratio)})`;
}

function formatIterationsPerSecond(value: number): string {
  if (value >= 1000) {
    return `${formatNumber(value / 1000)}k ops/sec`;
  }
  return `${formatNumber(value)} ops/sec`;
}

function formatMicroseconds(value: number): string {
  return `${formatNumber(value * 1000)} us`;
}

function formatRatio(value: number): string {
  return `${formatNumber(value)}x`;
}

function formatNumber(value: number): string {
  const maximumFractionDigits =
    value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value);
}

function printMarkdownTable(
  rowHeader: string,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): void {
  const headers = [
    rowHeader,
    ...options.modes.map((mode) => executorLabelForMode(mode)),
  ];
  const tableRows = [headers, ...rows];
  const widths = headers.map((_, columnIndex) =>
    Math.max(...tableRows.map((row) => row[columnIndex]?.length ?? 0)),
  );

  printMarkdownRow(headers, widths);
  printMarkdownRow(
    widths.map((width) => '-'.repeat(Math.max(3, width))),
    widths,
  );
  for (const row of rows) {
    printMarkdownRow(row, widths);
  }
}

function printMarkdownRow(
  row: ReadonlyArray<string>,
  widths: ReadonlyArray<number>,
): void {
  console.log(
    `| ${row
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join(' | ')} |`,
  );
}

function executorLabelForMode(mode: Mode): string {
  switch (mode) {
    case 'graphql-js-17':
      return `${baselineRevision} regular async`;
    case 'graphql-js-17-dataloader':
      return `${baselineRevision} dataloader`;
    case 'graphql-js-local-batch':
      return 'working tree batch';
    case 'graphql-breadth-js':
      return 'graphql-breadth-js';
    case 'grafast':
      return 'grafast';
    case 'graphql-jit':
      return 'graphql-jit';
  }
}

function ensureGC(): void {
  if (globalThis.gc === undefined) {
    throw new Error('Run with node --expose-gc.');
  }
}

function forceGC(): void {
  globalThis.gc?.();
}

async function flushPerformanceObserver(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function shuffled<T>(array: ReadonlyArray<T>): Array<T> {
  const shuffledArray = [...array];
  for (let index = shuffledArray.length - 1; index > 0; --index) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledArray[index], shuffledArray[randomIndex]] = [
      shuffledArray[randomIndex],
      shuffledArray[index],
    ];
  }
  return shuffledArray;
}
