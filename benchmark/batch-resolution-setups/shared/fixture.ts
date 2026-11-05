import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import type { DocumentNode } from '../../../src/language/ast.ts';
import { parse } from '../../../src/language/parser.ts';

export interface WidgetSource {
  [key: string]: unknown;
}

export interface BenchContext {
  readonly loaders?: {
    readonly widget: { load: (source: WidgetSource) => Promise<unknown> };
  };
}

export interface Scenario {
  readonly rowLabel: string;
  readonly query: string;
  readonly document: DocumentNode;
  readonly source: WidgetSource;
  readonly expectedRootWidgetCount: number | undefined;
}

export interface FirstArgs {
  readonly first?: number | null;
}

const sharedDir = path.dirname(url.fileURLToPath(import.meta.url));
const maxDepth = 18;
const multiplicationSign = '\u00d7';

export const schemaSDL: string = fs.readFileSync(
  path.join(sharedDir, 'schema.graphql'),
  'utf8',
);

export function createFlatListScenario(size: number): Scenario {
  return createScenario(
    String(size),
    `widgets(first: ${size}) { id }`,
    createListSource(size, createWidget),
    size,
  );
}

export function createWidgetListScenario(size: number): Scenario {
  return createScenario(
    String(size),
    `widgets(first: ${size}) { id widget { id } }`,
    createListSource(size, () => createWidget({ widget: createWidget() })),
    size,
  );
}

export function createTreeListScenario(
  depth: number,
  breadth: number,
): Scenario {
  return createScenario(
    `${depth} ${multiplicationSign} ${breadth}`,
    `widgets(first: ${breadth}) { ${buildTreeQuery(depth)} }`,
    createListSource(breadth, () => createWidgetTree(depth)),
    breadth,
  );
}

export function createDeepTreeScenario(depth: number): Scenario {
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
  if (depth < 0 || depth > maxDepth) {
    throw new Error(`Depth must be between 0 and ${maxDepth}.`);
  }
}
