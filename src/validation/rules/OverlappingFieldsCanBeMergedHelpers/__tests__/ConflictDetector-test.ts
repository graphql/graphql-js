import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../../../error/GraphQLError.ts';

import { parse } from '../../../../language/parser.ts';
import { visit } from '../../../../language/visitor.ts';

import type { GraphQLSchema } from '../../../../type/schema.ts';

import { buildSchema } from '../../../../utilities/buildASTSchema.ts';
import { TypeInfo, visitWithTypeInfo } from '../../../../utilities/TypeInfo.ts';

import { ValidationContext } from '../../../ValidationContext.ts';

import { ConflictDetector } from '../ConflictDetector.ts';

const schema = buildSchema(`
  interface Pet {
    name(surname: Boolean): String
    nickname: String
    child: Pet
    otherChild: Pet
    children: [Pet]
  }

  type Cat implements Pet {
    name(surname: Boolean): String
    nickname: String
    child: Pet
    otherChild: Pet
    children: [Pet]
  }

  type Dog implements Pet {
    name(surname: Boolean): String
    nickname: String
    child: Pet
    otherChild: Pet
    children: [Pet]
  }

  type Query {
    pet: Pet
  }
`);

function detect(
  source: string,
  testSchema: GraphQLSchema = schema,
  noLocation = false,
) {
  const document = parse(source, {
    experimentalFragmentArguments: true,
    noLocation,
  });
  const typeInfo = new TypeInfo(testSchema);
  const errors: Array<GraphQLError> = [];
  const context = new ValidationContext(
    testSchema,
    document,
    typeInfo,
    (error) => {
      errors.push(error);
    },
  );
  const detector = new ConflictDetector(context);
  visit(document, visitWithTypeInfo(typeInfo, detector.getVisitor()));
  return errors;
}

describe('ConflictDetector', () => {
  it('accepts repeated fields reached through inline and named fragments', () => {
    expect(
      detect(`
        {
          pet {
            ... { child { ...Fields } }
            ... { child { ...Fields } }
          }
        }
        fragment Fields on Pet { name }
      `),
    ).to.deep.equal([]);
  });

  it('accepts a singleton fragment group', () => {
    expect(
      detect(`
        { pet { ...Fields } }
        fragment Fields on Pet { child { name } }
      `),
    ).to.deep.equal([]);
  });

  it('accepts matching calls on mutually exclusive parents', () => {
    expect(
      detect(`
        {
          pet {
            ... on Cat { value: name }
            ... on Dog { value: name }
          }
        }
      `),
    ).to.deep.equal([]);
  });

  it('reports a nested conflict at its containing field', () => {
    const errors = detect(`
      {
        pet {
          child { value: name }
          child { value: nickname }
        }
      }
    `);

    expect(errors.map((error) => error.message)).to.deep.equal([
      'Fields "child" conflict because subfields "value" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports conflicts within one field set', () => {
    const errors = detect(`
      {
        pet {
          internal: name
          internal: nickname
        }
      }
    `);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "internal" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports conflicts across field sets', () => {
    const errors = detect(`
      { pet { shared: name ...ConflictingType } }
      fragment ConflictingType on Pet { shared: nickname }
    `);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "shared" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports response-shape conflicts without source locations', () => {
    const errors = detect(
      `{
        pet {
          ... on Cat { value: name }
          ... on Dog { value: child { name } }
        }
      }`,
      schema,
      true,
    );

    expect(errors).to.have.length(1);
  });

  it('does not let an unknown output type hide known type conflicts', () => {
    const errors = detect(`
      fragment UnknownFirst on Missing {
        value: mystery { name }
        ...KnownScalar
        ...KnownObject
      }
      fragment KnownScalar on Cat { value: name }
      fragment KnownObject on Dog { value: child { name } }
    `);

    expect(errors.map((error) => error.message)).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "String" and "Pet". Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports conflicting types on mutually exclusive parents', () => {
    const errors = detect(`
      {
        pet {
          ... on Cat { value: name }
          ... on Dog { value: child { name } }
        }
      }
    `);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "String" and "Pet". Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('compares abstract fields with each possible concrete parent', () => {
    const errors = detect(`
      fragment Conflicting on Pet {
        value: name(surname: true)
        ... on Dog { value: name(surname: false) }
      }

      fragment Exclusive on Pet {
        ... on Cat { value: name(surname: true) }
        ... on Dog { value: name(surname: false) }
      }
    `);

    expect(errors.map((error) => error.message)).to.deep.equal([
      'Fields "value" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('continues checking child fields after reporting call conflicts', () => {
    const errors = detect(`
      fragment MixedCalls on Dog {
        value: child {
          fieldName: name
          arguments: name(surname: true)
        }
        value: child {
          fieldName: nickname
          arguments: name(surname: false)
        }
        value: otherChild { name }
      }
    `);
    const messages = errors.map((error) => error.message);

    expect(errors).to.have.length(3);
    expect(
      messages.filter((message) =>
        message.includes('"child" and "otherChild" are different fields'),
      ),
    ).to.have.length(2);
    expect(messages).to.include(
      'Fields "value" conflict because subfields "fieldName" conflict because "name" and "nickname" are different fields and subfields "arguments" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    );
  });

  it('reports child conflicts beneath incompatible calls', () => {
    const errors = detect(`
      fragment IncompatibleCalls on Pet {
        value: child { nested: name(surname: true) }
        value: otherChild { nested: name(surname: false) }
      }
    `);

    expect(errors.map((error) => error.message)).to.deep.equal([
      'Fields "value" conflict because "child" and "otherChild" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
      'Fields "value" conflict because subfields "nested" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('continues checking child fields across abstract and concrete parents', () => {
    const errors = detect(`
      fragment MixedParents on Pet {
        value: child { fieldName: name }
        ... on Dog {
          value: child { fieldName: nickname }
          value: otherChild { name }
        }
      }
    `);
    const messages = errors.map((error) => error.message);

    expect(errors).to.have.length(3);
    expect(
      messages.filter((message) =>
        message.includes('"child" and "otherChild" are different fields'),
      ),
    ).to.have.length(2);
    expect(messages).to.include(
      'Fields "value" conflict because subfields "fieldName" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    );
  });

  it('continues checking child fields after type conflicts', () => {
    const errors = detect(`
      fragment MixedTypes on Pet {
        value: child { result: name(surname: true) }
        value: children { result: name(surname: false) }
      }
    `);
    const messages = errors.map((error) => error.message);

    expect(errors).to.have.length(3);
    expect(messages).to.include(
      'Fields "value" conflict because they return conflicting types "Pet" and "[Pet]". Use different aliases on the fields to fetch both if this was intentional.',
    );
    expect(messages).to.include(
      'Fields "value" conflict because "child" and "children" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    );
    expect(messages).to.include(
      'Fields "value" conflict because subfields "result" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    );
  });

  it('continues checking child fields after stream conflicts', () => {
    const errors = detect(`
      fragment MixedStreams on Pet {
        value: child { ... on Cat { result: name } }
        value: child { ... on Dog { result: child { name } } }
        value: child @stream { name }
      }
    `);
    const messages = errors.map((error) => error.message);

    expect(errors).to.have.length(3);
    expect(
      messages.filter((message) =>
        message.includes('overlapping stream directives'),
      ),
    ).to.have.length(2);
    expect(messages).to.include(
      'Fields "value" conflict because subfields "result" conflict because they return conflicting types "String" and "Pet". Use different aliases on the fields to fetch both if this was intentional.',
    );
  });

  it('checks unreferenced fragment dependency chains', () => {
    const errors = detect(`
      fragment C on Pet { value: nickname }
      fragment B on Pet { ...C }
      fragment A on Pet { value: name ...B }
    `);

    expect(errors).to.have.length(1);
  });

  it('checks unreferenced fragment dependency cycles', () => {
    const errors = detect(`
      fragment A on Pet { ...B }
      fragment B on Pet { ...C }
      fragment C on Pet { ...A value: name value: nickname }
    `);

    expect(errors).to.have.length(1);
  });

  it('does not duplicate a streamed field reached through repeated fragments', () => {
    expect(
      detect(`
        {
          pet {
            child { ...Streamed }
            child { ...Streamed }
          }
        }
        fragment Streamed on Pet {
          name @stream
        }
      `),
    ).to.deep.equal([]);
  });

  it('reports every pair in a mixed streamed group', () => {
    const errors = detect(`
      {
        pet {
          name @stream(label: "same")
          name @stream(label: "same")
          name
        }
      }
    `);

    expect(errors).to.have.length(3);
    expect(
      errors.some((error) =>
        error.message.includes(
          'overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100.',
        ),
      ),
    ).to.equal(true);
  });

  it('reports one conflict for every field without a stream directive', () => {
    const fields = Array.from(
      { length: 15 },
      (_, index) => `name${index === 14 ? ' @stream' : ''}`,
    ).join('\n');

    expect(detect(`{ pet { ${fields} } }`)).to.have.length(14);
  });

  it('reports every stream conflict in a large field group', () => {
    const fields = Array.from(
      { length: 102 },
      (_, index) => `name${index === 0 ? ' @stream' : ''}`,
    ).join('\n');

    expect(detect(`{ pet { ${fields} } }`)).to.have.length(101);
  });

  it('reports a stream conflict regardless of occurrence order', () => {
    expect(detect('{ pet { name @stream name } }')).to.have.length(1);
    expect(detect('{ pet { name name @stream } }')).to.have.length(1);
  });

  it('reports every conflicting pair in a large field group', () => {
    const fields = [
      'value: name(surname: false)',
      ...Array.from({ length: 101 }, () => 'value: name(surname: true)'),
    ].join('\n');
    const errors = detect(`{ pet { ${fields} } }`);

    expect(errors).to.have.length(101);
  });

  it('accepts large groups without stream conflicts', () => {
    const fields = Array.from({ length: 15 }, () => 'name').join('\n');
    const spreads = Array.from({ length: 15 }, () => '...F').join('\n');

    expect(
      detect(`
        { pet { ${fields} ${spreads} } }
        fragment F on Pet { name }
      `),
    ).to.deep.equal([]);
  });

  it('reports conflicts separately for structurally equal fragment bodies', () => {
    const errors = detect(`
      fragment F on Pet {
        value: name
        value: nickname
      }
      fragment G on Pet {
        value: name
        value: nickname
      }
    `);

    expect(errors).to.have.length(2);
    expect(errors[0]?.nodes).not.to.deep.equal(errors[1]?.nodes);
  });
});
