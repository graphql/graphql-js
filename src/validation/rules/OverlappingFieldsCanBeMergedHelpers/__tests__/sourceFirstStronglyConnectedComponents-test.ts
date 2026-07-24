import { describe, it } from 'node:test';

import { expect } from 'chai';

import { sourceFirstStronglyConnectedComponents } from '../sourceFirstStronglyConnectedComponents.ts';

interface Node {
  name: string;
  dependencies: Set<Node>;
}

function node(name: string): Node {
  return { name, dependencies: new Set() };
}

function names(
  components: ReadonlyArray<ReadonlyArray<Node>>,
): Array<Array<string>> {
  return components.map((component) =>
    component.map(({ name }) => name).sort(),
  );
}

describe('sourceFirstStronglyConnectedComponents', () => {
  it('orders sources before a shared dependency', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    a.dependencies.add(c);
    b.dependencies.add(c);

    const components = names(
      sourceFirstStronglyConnectedComponents(
        [c, b, a],
        (item) => item.dependencies,
      ),
    );

    expect(components.slice(0, 2).flat().sort()).to.deep.equal(['A', 'B']);
    expect(components[2]).to.deep.equal(['C']);
  });

  it('ignores dependencies outside the input graph', () => {
    const a = node('A');
    a.dependencies.add(node('outside'));

    expect(
      names(
        sourceFirstStronglyConnectedComponents(
          [a],
          (item) => item.dependencies,
        ),
      ),
    ).to.deep.equal([['A']]);
  });

  it('combines cycles and orders their dependencies afterward', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    a.dependencies.add(b);
    b.dependencies.add(a);
    b.dependencies.add(c);

    expect(
      names(
        sourceFirstStronglyConnectedComponents(
          [a, b, c],
          (item) => item.dependencies,
        ),
      ),
    ).to.deep.equal([['A', 'B'], ['C']]);
  });

  it('deduplicates edges between the same components', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    a.dependencies.add(b);
    a.dependencies.add(c);
    b.dependencies.add(a);
    b.dependencies.add(c);

    expect(
      names(
        sourceFirstStronglyConnectedComponents(
          [a, b, c],
          (item) => item.dependencies,
        ),
      ),
    ).to.deep.equal([['A', 'B'], ['C']]);
  });

  it('accepts an empty graph', () => {
    expect(
      sourceFirstStronglyConnectedComponents(
        [],
        (item: Node) => item.dependencies,
      ),
    ).to.deep.equal([]);
  });

  it('orders dependency chains', () => {
    const nodes = Array.from({ length: 100 }, (_, index) =>
      node(String(index)),
    );
    for (let index = 0; index + 1 < nodes.length; ++index) {
      nodes[index].dependencies.add(nodes[index + 1]);
    }

    const components = sourceFirstStronglyConnectedComponents(
      nodes.toReversed(),
      (item) => item.dependencies,
    );

    expect(components).to.have.length(nodes.length);
    expect(components[0]).to.deep.equal([nodes[0]]);
    expect(components.at(-1)).to.deep.equal([nodes.at(-1)]);
  });
});
