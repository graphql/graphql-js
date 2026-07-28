import { invariant } from '../../../jsutils/invariant.ts';

/**
 * Partitions a graph into strongly connected components and returns each
 * component before the components it depends on.
 *
 * @internal
 */
export function sourceFirstStronglyConnectedComponents<T extends object>(
  nodes: ReadonlyArray<T>,
  dependencies: (node: T) => Iterable<T>,
): Array<ReadonlyArray<T>> {
  const outgoing = new Map<T, Array<T>>();
  const incoming = new Map<T, Array<T>>();
  for (const node of nodes) {
    outgoing.set(node, []);
    incoming.set(node, []);
  }
  for (const node of nodes) {
    const nodeOutgoing = outgoing.get(node);
    invariant(nodeOutgoing !== undefined);
    // Materialize both directions because dependencies may be generated
    // lazily and each traversal follows a different direction.
    for (const dependency of dependencies(node)) {
      const dependencyIncoming = incoming.get(dependency);
      if (dependencyIncoming === undefined) {
        continue;
      }
      nodeOutgoing.push(dependency);
      dependencyIncoming.push(node);
    }
  }

  const visited = new Set<T>();
  const finished = new Array<T>();
  // Record a node only after every dependency reachable from it is finished.
  function finish(node: T): void {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    const nodeOutgoing = outgoing.get(node);
    invariant(nodeOutgoing !== undefined);
    for (const dependency of nodeOutgoing) {
      finish(dependency);
    }
    finished.push(node);
  }
  for (const node of nodes) {
    finish(node);
  }

  const components = new Array<Array<T>>();
  const assigned = new Set<T>();
  function collect(node: T, component: Array<T>): void {
    if (assigned.has(node)) {
      return;
    }
    assigned.add(node);
    component.push(node);
    const nodeIncoming = incoming.get(node);
    invariant(nodeIncoming !== undefined);
    for (const predecessor of nodeIncoming) {
      collect(predecessor, component);
    }
  }
  // Traversing the transpose in reverse completion order discovers source
  // components before their dependencies.
  for (let index = finished.length - 1; index >= 0; --index) {
    const node = finished[index];
    invariant(node !== undefined);
    if (assigned.has(node)) {
      continue;
    }
    const component = new Array<T>();
    collect(node, component);
    components.push(component);
  }
  return components;
}
