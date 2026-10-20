import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { SelectionSetNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';
import { print } from '../../language/printer.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { OverlappingFieldsCanBeMergedRule } from '../rules/OverlappingFieldsCanBeMergedRule.ts';
import { validate } from '../validate.ts';

import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
} from './harness.ts';

function expectErrors(queryStr: string) {
  return expectValidationErrors(OverlappingFieldsCanBeMergedRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectErrorsWithSchema(schema: GraphQLSchema, queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    OverlappingFieldsCanBeMergedRule,
    queryStr,
  );
}

function expectValidWithSchema(schema: GraphQLSchema, queryStr: string) {
  expectErrorsWithSchema(schema, queryStr).toDeepEqual([]);
}

describe('Validate: Overlapping fields can be merged', () => {
  it('stops at the first conflict without stopping other validation rules', () => {
    const schema = buildSchema('type Query { first: Int, second: Int }');
    const document = parse(`
      query First { a: first a: second missing }
      query Second { b: first b: second absent }
    `);
    expect(
      validate(schema, document).map((error) => error.message),
    ).to.deep.equal([
      'Fields "a" conflict because "first" and "second" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
      'Cannot query field "missing" on type "Query".',
      'Cannot query field "absent" on type "Query".',
    ]);
  });

  it('stops at the first fragment-argument conflict', () => {
    const schema = buildSchema('type Query { value(arg: Int): Int }');
    const document = parse(
      `
        { ...Local(x: 1) ...Local(x: 2) ...Local(x: 3) }
        fragment Local($x: Int) on Query { value(arg: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include('have different fragment arguments');
    expect(errors[0].nodes).to.have.lengthOf(2);
  });

  it('preserves the validation-wide error limit', () => {
    const schema = buildSchema('type Query { first: Int, second: Int }');
    const document = parse('{ a: first a: second missing }');
    expect(
      validate(schema, document, undefined, { maxErrors: 0 }).map(
        (error) => error.message,
      ),
    ).to.deep.equal([
      'Too many validation errors, error limit reached. Validation aborted.',
    ]);
  });

  it('merges repeated references to the same child selection set', () => {
    const schema = buildSchema('type Query { child: Query, value: Int }');
    const document = parse('{ child { value } child { value } }');
    const operation = document.definitions[0];
    if (operation.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('Expected an operation.');
    }
    const first = operation.selectionSet.selections[0];
    expect(
      validate(schema, {
        ...document,
        definitions: [
          {
            ...operation,
            selectionSet: {
              selections: [first, first],
              kind: Kind.SELECTION_SET,
            },
          },
        ],
      }),
    ).to.deep.equal([]);
  });

  it('merges every child selection, not just pairs with a representative', () => {
    const schema = buildSchema(
      'type Query { child: Query, value(arg: Int): Int, other: Int }',
    );
    const document = parse(`
      { ...First ...Second ...Third }
      fragment First on Query { child { other } }
      fragment Second on Query { child { value(arg: 1) } }
      fragment Third on Query { child { value(arg: 2) } }
    `);
    expect(
      validate(schema, document).map((error) => error.message),
    ).to.deep.equal([
      'Fields "value" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
  });

  it('preserves exclusive ancestors while sharing abstract child selections', () => {
    const schema = buildSchema(`
      interface Node { child: Child }
      type First implements Node { child: Child }
      type Second implements Node { child: Child }
      type Child { value(arg: Int): Int, other: Int }
      type Query { node: Node }
    `);
    expect(
      validate(
        schema,
        parse(`{
        node {
          child { other }
          ... on First { child { value(arg: 1) } }
          ... on Second { child { value(arg: 2) } }
        }
      }`),
      ),
    ).to.deep.equal([]);
  });

  it('checks field names after reusing a response-shape comparison', () => {
    const schema = buildSchema(`
      type Query { node: Node, other: Child }
      union Node = First | Second
      type First { child: Child }
      type Second { child: Child }
      type Child { value: Value }
      type Value { first: Int, second: Int }
    `);
    const exclusive = `
      node {
        ... on First { child { ...Left } }
        ... on Second { child { ...Right } }
      }
    `;
    const fragments = `
      fragment Left on Child { value { field: first } }
      fragment Right on Child { value { field: second } }
    `;
    expectValidWithSchema(schema, `{ ${exclusive} } ${fragments}`);
    const document = parse(`
      { ${exclusive} other { ...Left ...Right } }
      ${fragments}
    `);
    expect(
      validate(schema, document).map((error) => error.message),
    ).to.deep.equal([
      'Fields "field" conflict because "first" and "second" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
  });

  it('reuses response-shape checks across exclusive fragment uses', () => {
    const schema = buildSchema(`
      type Query { node: Node }
      union Node = First | Second
      type First { child: Child }
      type Second { child: Child }
      type Child { first: Int, second: Int }
    `);
    expectValidWithSchema(
      schema,
      `
        {
          a: node { ...Left ...Right }
          b: node { ...Left ...Right }
        }
        fragment Left on First { child { field: first } }
        fragment Right on Second { child { field: second } }
      `,
    );
  });

  it('merges matching list and non-null shapes across object parents', () => {
    const schema = buildSchema(`
      union Node = First | Second
      type First { values: [Int!]! }
      type Second { values: [Int!]! }
      type Query { node: Node }
    `);
    expectValidWithSchema(
      schema,
      '{ node { ... on First { values } ... on Second { values } } }',
    );
  });

  it('checks known return shapes after an unknown field', () => {
    const schema = buildSchema(`
      union Node = First | Second | Third
      type First { other: Int }
      type Second { value: Int }
      type Third { value: String }
      type Query { node: Node }
    `);
    const document = parse(`{
      node {
        ... on First { value }
        ... on Second { value }
        ... on Third { value }
      }
    }`);
    expect(
      validate(schema, document, [OverlappingFieldsCanBeMergedRule]).map(
        (error) => error.message,
      ),
    ).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "Int" and "String". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
  });

  it('reports field conflicts while ignoring unknown fragments in either order', () => {
    const schema = buildSchema('type Query { first: Int, second: Int }');
    for (const spreads of ['...Known ...Unknown', '...Unknown ...Known']) {
      const document = parse(`
        { value: first value: second ${spreads} }
        fragment Known on Query { first }
      `);
      expect(
        validate(schema, document, [OverlappingFieldsCanBeMergedRule]).map(
          (error) => error.message,
        ),
      ).to.deep.equal([
        'Fields "value" conflict because "first" and "second" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
      ]);
    }
  });

  it('reports the first conflicting leaf pair without ancestor locations', () => {
    const schema = buildSchema(
      'type Query { child: Query, left: Int, right: Int }',
    );
    const fields = (name: string) => `
      early: child { cause: ${name} }
      middle: ${'child { '.repeat(10)} leaf: ${name} ${' }'.repeat(10)}
      late: ${'child { '.repeat(10)} leaf: ${name} ${' }'.repeat(10)}
    `;
    const errors = validate(
      schema,
      parse(`{ child { ${fields('left')} } child { ${fields('right')} } }`),
      [OverlappingFieldsCanBeMergedRule],
    );
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include('Fields "cause" conflict');
    expect(errors[0].locations).to.have.lengthOf(2);
    expect(
      errors[0].nodes?.filter(
        (node) => node.kind === Kind.FIELD && node.alias?.value === 'cause',
      ),
    ).to.have.lengthOf(2);
  });

  it('omits large fragment arguments only in descriptions', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const document = parse(
      `
          { ...Local(x: "${'small words '.repeat(24)}") ...Local(x: 2) }
        fragment Local($x: Input) on Query { field(value: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors.map((error) => error.message)).to.deep.equal([
      'Spreads "Local" conflict because Local(...) and Local(x: 2) have different fragment arguments.',
    ]);
    expect(print(document)).to.include('small words '.repeat(24));
  });

  it('prints structured fragment arguments in conflict descriptions', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const document = parse(
      `
        query ($outside: Int) {
          ...Local(x: { list: [null, true, false, 1, 1.5, "text", $outside] })
          ...Local(x: 0)
        }
        fragment Local($x: Input) on Query { field(value: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    expect(
      validate(schema, document, [OverlappingFieldsCanBeMergedRule]).map(
        (error) => error.message,
      ),
    ).to.deep.equal([
      'Spreads "Local" conflict because Local(x: { list: [null, true, false, 1, 1.5, "text", $outside] }) and Local(x: 0) have different fragment arguments.',
    ]);
  });

  it('reports leaf locations regardless of the conflict path length', () => {
    const schema = buildSchema(
      'type Query { child: Query, left: Int, right: Int }',
    );
    const first = 'child { '.repeat(21) + 'same: left' + ' }'.repeat(21);
    const second = 'child { '.repeat(21) + 'same: right' + ' }'.repeat(21);
    const errors = validate(schema, parse(`{ ${first} ${second} }`), [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].locations).to.have.lengthOf(2);
    expect(
      errors[0].nodes?.filter(
        (node) => node.kind === Kind.FIELD && node.alias?.value === 'same',
      ),
    ).to.have.lengthOf(2);
  });

  it('reports nested conflicts directly', () => {
    const schema = buildSchema(
      'type Query { child: Query, left: Int, right: Int }',
    );
    const first = 'child { '.repeat(7) + 'same: left' + ' }'.repeat(7);
    const second = 'child { '.repeat(7) + 'same: right' + ' }'.repeat(7);
    const document = parse(`{ ${first} ${second} }`);
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include(
      '"left" and "right" are different fields',
    );
    expect(errors[0].locations).to.have.lengthOf(2);
    expect(
      errors[0].nodes?.filter(
        (node) => node.kind === Kind.FIELD && node.alias?.value === 'same',
      ),
    ).to.have.lengthOf(2);
  });

  it('abbreviates long names in conflict messages', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    const name = 'name'.repeat(260);
    const document = parse(`{ ${name}: ${name} ${name}: field }`);
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include(name.slice(0, 1000) + '...');
    expect(errors[0].message).not.to.include(name);
    expect(errors[0].locations).to.have.lengthOf(2);
  });

  it('reports only the first of several independent conflicts', () => {
    const schema = buildSchema(
      'type Query { child: Query, left: Int, right: Int }',
    );
    const names = Array.from(
      { length: 5 },
      (_, i) => `field${i}_${'detail'.repeat(40)}`,
    );
    const first = names.map((name) => `${name}: left`).join(' ');
    const second = names.map((name) => `${name}: right`).join(' ');
    const errors = validate(
      schema,
      parse(`{ child { ${first} } child { ${second} } }`),
      [OverlappingFieldsCanBeMergedRule],
    );
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message.length).to.be.lessThan(1200);
    expect(errors[0].locations).to.have.lengthOf(2);
  });

  it('reports conflicts without source locations', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    const document = parse('{ field(value: 1) field(value: 2) }', {
      noLocation: true,
    });
    const errors = validate(schema, document);
    expect(errors.map((error) => error.message)).to.deep.equal([
      'Fields "field" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
    expect(errors[0].locations).to.equal(undefined);
  });

  it('reports fragment argument conflicts when one spread omits arguments', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    const document = parse(
      `
        { ...Local ...Local(x: 1) }
        fragment Local($x: Int) on Query { field(value: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    expect(
      validate(schema, document).map((error) => error.message),
    ).to.deep.equal([
      'Spreads "Local" conflict because Local and Local(x: 1) have different fragment arguments.',
    ]);
  });

  it('keeps similarly named variables from different scopes distinct', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    const document = parse(
      `
        query ($__1_x: Int) {
          ...Local(x: 1)
          field(value: $__1_x)
        }
        fragment Local($x: Int) on Query { field(value: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    expect(
      validate(schema, document).map((error) => error.message),
    ).to.deep.equal([
      'Fields "field" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
  });

  it('unique fields', () => {
    expectValid(`
      fragment uniqueFields on Dog {
        name
        nickname
      }
    `);
  });

  it('identical fields', () => {
    expectValid(`
      fragment mergeIdenticalFields on Dog {
        name
        name
      }
    `);
  });

  it('identical fields with identical args', () => {
    expectValid(`
      fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('identical fields with identical directives', () => {
    expectValid(`
      fragment mergeSameFieldsWithSameDirectives on Dog {
        name @include(if: true)
        name @include(if: true)
      }
    `);
  });

  it('different args with different aliases', () => {
    expectValid(`
      fragment differentArgsWithDifferentAliases on Dog {
        knowsSit: doesKnowCommand(dogCommand: SIT)
        knowsDown: doesKnowCommand(dogCommand: DOWN)
      }
    `);
  });

  it('different directives with different aliases', () => {
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        nameIfTrue: name @include(if: true)
        nameIfFalse: name @include(if: false)
      }
    `);
  });

  it('different skip/include directives accepted', () => {
    // Note: Differing skip/include directives don't create an ambiguous return
    // value and are acceptable in conditions where differing runtime values
    // may have the same desired effect of including or skipping a field.
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        name @include(if: true)
        name @include(if: false)
      }
    `);
  });

  it('stream directive used on different instances of the same field', () => {
    expectErrors(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        name @stream(label: "streamLabel", initialCount: 1)
        name @stream(label: "streamLabel", initialCount: 1)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive label', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream(label: "streamLabel", initialCount: 1)
        name @stream(label: "anotherLabel", initialCount: 1)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('detects stream overlap when only the later field is streamed', () => {
    expectErrors(`
      fragment streamed on Dog {
        name
        name @stream
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive initialCount', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream(label: "streamLabel", initialCount: 1)
        name @stream(label: "streamLabel", initialCount: 2)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive first missing args', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream
        name @stream(label: "streamLabel", initialCount: 1)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive second missing args', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream(label: "streamLabel", initialCount: 1)
        name @stream
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive extra argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream(label: "streamLabel", initialCount: 1)
        name @stream(label: "streamLabel", initialCount: 1, extraArg: true)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('mix of stream and no stream', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream
        name
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different stream directive both missing args', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        name @stream
        name @stream
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('Same aliases with different field targets', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        fido: name
        fido: nickname
      }
    `).toDeepEqual([
      {
        message:
          'Fields "fido" conflict because "name" and "nickname" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('Same aliases allowed on non-overlapping fields', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment sameAliasesWithDifferentFieldTargets on Pet {
        ... on Dog {
          name
        }
        ... on Cat {
          name: nickname
        }
      }
    `);
  });

  it('Alias masking direct field access', () => {
    expectErrors(`
      fragment aliasMaskingDirectFieldAccess on Dog {
        name: nickname
        name
      }
    `).toDeepEqual([
      {
        message:
          'Fields "name" conflict because "nickname" and "name" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, second adds an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand
        doesKnowCommand(dogCommand: HEEL)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, second missing an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand
      }
    `).toDeepEqual([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, first has two, second missing one', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT, atExpertLevel: true)
        doesKnowCommand(dogCommand: SIT)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('conflicting arg values', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: HEEL)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('conflicting arg names', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        isAtLocation(x: 0)
        isAtLocation(y: 0)
      }
    `).toDeepEqual([
      {
        message:
          'Fields "isAtLocation" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('allows different args where no conflict is possible', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment conflictingArgs on Pet {
        ... on Dog {
          name(surname: true)
        }
        ... on Cat {
          name
        }
      }
    `);
  });

  it('allows different order of args', () => {
    const schema = buildSchema(`
      type Query {
        someField(a: String, b: String): String
      }
    `);

    // This is valid since arguments are unordered, see:
    // https://spec.graphql.org/draft/#sec-Language.Arguments.Arguments-are-unordered
    expectValidWithSchema(
      schema,
      `
        {
          someField(a: null, b: null)
          someField(b: null, a: null)
        }
      `,
    );
  });

  it('allows different order of input object fields in arg values', () => {
    const schema = buildSchema(`
      input SomeInput {
        a: String
        b: String
      }

      type Query {
        someField(arg: SomeInput): String
      }
    `);

    // This is valid since input object fields are unordered, see:
    // https://spec.graphql.org/draft/#sec-Input-Object-Values.Input-object-fields-are-unordered
    expectValidWithSchema(
      schema,
      `
        {
          someField(arg: { a: null, b: null })
          someField(arg: { b: null, a: null })
        }
      `,
    );
  });

  it('compares nested input values with empty collections and block strings', () => {
    const schema = buildSchema(`
      input SomeInput {
        text: String
        children: [SomeInput]
      }
      type Query {
        someField(arg: SomeInput): String
      }
    `);

    expectValidWithSchema(
      schema,
      `
        {
          someField(arg: {
            text: """first line
second line"""
            children: [{ text: "value", children: [] }, {}]
          })
          someField(arg: {
            children: [{ children: [], text: "value" }, {}]
            text: """first line
second line"""
          })
        }
      `,
    );
  });

  it('distinguishes value kinds, string forms, and collection order', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const values = [
      '1',
      '1.0',
      '"1"',
      '"""1"""',
      'true',
      'false',
      'null',
      'VALUE',
      '$value',
      '[]',
      '{}',
      '[1, 2]',
      '[2, 1]',
      '{ a: 1 }',
      '{ b: 1 }',
      '{ a: 2 }',
      '{ a: 1, a: 2 }',
      '{ a: 2, a: 1 }',
    ];
    for (const first of values) {
      for (const second of values) {
        const document = parse(
          `{ field(value: ${first}) field(value: ${second}) }`,
        );
        const errors = validate(schema, document, [
          OverlappingFieldsCanBeMergedRule,
        ]);
        expect(errors).to.have.lengthOf(first === second ? 0 : 1);
      }
    }
  });

  it('compares object fields without changing the source AST', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const document = parse(`{
      field(value: { z: [{ b: 2, a: 1 }], a: true, a: false })
      field(value: { a: true, z: [{ a: 1, b: 2 }], a: false })
    }`);
    const before = print(document);
    expect(
      validate(schema, document, [OverlappingFieldsCanBeMergedRule]),
    ).to.deep.equal([]);
    expect(print(document)).to.equal(before);
  });

  it('accepts several overlapping fields with identical values', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    expectValidWithSchema(
      schema,
      '{ field(value: 1) field(value: 1) field(value: 1) }',
    );
  });

  it('distinguishes local references after operation references', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    for (const [value, errorCount] of [
      ['[$outside, $outside]', 0],
      ['[$outside, $x]', 1],
    ] as const) {
      const document = parse(
        `query ($outside: Input) { ...Left(x: 1) ...Right(x: 1) }
        fragment Left($x: Input) on Query { ...Shared(value: ${value}) }
        fragment Right($x: Input) on Query { ...Shared(value: ${value}) }
        fragment Shared($value: Input) on Query { field(value: $value) }`,
        { experimentalFragmentArguments: true },
      );
      const errors = validate(schema, document, [
        OverlappingFieldsCanBeMergedRule,
      ]);
      expect(errors).to.have.lengthOf(errorCount);
      if (errorCount !== 0) {
        expect(errors[0].message).to.include('different fragment arguments');
      }
    }
  });

  it('compares nested fragment arguments in their enclosing variable scope', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    expectValidWithSchema(
      schema,
      `
        query First($outside: Input) { ...Outer(x: 1) }
        query Second($outside: Input) { ...Outer(x: 2) }
        fragment Outer($x: Input) on Query {
          ...Inner(value: { values: [$x, $outside, 1], other: true })
          ...Inner(value: { other: true, values: [$x, $outside, 1] })
        }
        fragment Inner($value: Input) on Query { field(value: $value) }
      `,
    );
  });

  it('reuses value comparisons while checking each variable scope', () => {
    const schema = buildSchema(
      'type Query { child: Query, value(arg: Int): Int }',
    );
    const document = parse(
      `
        {
          same: child { ...F(x: 1) child { ...F(x: 1) } }
          different: child { ...F(x: 1) child { ...F(x: 2) } }
        }
        fragment F($x: Int) on Query {
          value(arg: $x)
          child { value(arg: $x) }
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include('they have differing arguments');
    expect(errors[0].locations?.[0].line).to.equal(8);
  });

  it('keeps variable scopes separate when fields share their argument nodes', () => {
    const schema = buildSchema('type Query { value(arg: Int): Int }');
    const document = parse(
      `
        { ...First(x: 1) ...Second(x: 1) }
        fragment First($x: Int) on Query { value(arg: $x) }
        fragment Second($x: Int) on Query { value(arg: $x) }
      `,
      { experimentalFragmentArguments: true },
    );
    const [first, second] = document.definitions.filter(
      (definition) => definition.kind === Kind.FRAGMENT_DEFINITION,
    );
    const sharedDocument = {
      ...document,
      definitions: document.definitions.map((definition) =>
        definition === second
          ? {
              ...second,
              selectionSet: {
                ...second.selectionSet,
                selections: first.selectionSet.selections.map((node) => ({
                  ...node,
                })),
              },
            }
          : definition,
      ),
    };
    const errors = validate(schema, sharedDocument, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.include('they have differing arguments');
  });

  it('compares unknown field names consistently across fragment uses', () => {
    const schema = buildSchema('type Query { child: Query }');
    const document = parse(
      `
        {
          a: child { ...A(x: 1) ...B(x: 1) }
          b: child { ...A(x: 2) ...B(x: 2) }
          c: child { ...A(x: 1) ...C(x: 1) }
          d: child { ...A(x: 2) ...C(x: 2) }
        }
        fragment A($x: Int) on Query { alias: missing }
        fragment B($x: Int) on Query { alias: missing }
        fragment C($x: Int) on Query { alias: other }
      `,
      { experimentalFragmentArguments: true },
    );
    const errors = validate(schema, document, [
      OverlappingFieldsCanBeMergedRule,
    ]);
    expect(errors).to.have.lengthOf(1);
    for (const error of errors) {
      expect(error.message).to.include(
        '"missing" and "other" are different fields',
      );
    }
  });

  it('keeps field definitions separate when a selection set is shared between types', () => {
    const schema = buildSchema(`
      type Query { node: Union }
      union Union = First | Second
      type First { value: Int }
      type Second { value: String }
    `);
    const document = parse(`
      { node { ...First ...Second } }
      fragment First on First { value }
      fragment Second on Second { value }
    `);
    const [first, second] = document.definitions.filter(
      (definition) => definition.kind === Kind.FRAGMENT_DEFINITION,
    );
    const sharedDocument = {
      ...document,
      definitions: document.definitions.map((definition) =>
        definition === second
          ? { ...second, selectionSet: first.selectionSet }
          : definition,
      ),
    };
    expect(
      validate(schema, sharedDocument).map((error) => error.message),
    ).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "Int" and "String". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
    ]);
  });

  it('encounters conflict in fragments', () => {
    expectErrors(`
      {
        ...A
        ...B
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 7, column: 9 },
          { line: 10, column: 9 },
        ],
      },
    ]);
  });

  it('does not repeat the same conflict across fragment uses', () => {
    expectErrors(`
      {
        f1 {
          ...A
          ...B
        }
        f2 {
          ...B
          ...A
        }
        f3 {
          ...A
          ...B
          x: c
        }
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 18, column: 9 },
          { line: 21, column: 9 },
        ],
      },
    ]);
  });

  it('deep conflict', () => {
    expectErrors(`
      {
        field {
          x: a
        },
        field {
          x: b
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 4, column: 11 },
          { line: 7, column: 11 },
        ],
      },
    ]);
  });

  it('deep conflict with multiple issues', () => {
    expectErrors(`
      {
        field {
          x: a
          y: c
        },
        field {
          x: b
          y: d
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 4, column: 11 },
          { line: 8, column: 11 },
        ],
      },
    ]);
  });

  it('stops at a parent-call conflict before checking child shapes', () => {
    expectErrors(`
      fragment incompatibleParents on Dog {
        parent: mother {
          value: name
        }
        parent: father {
          value: mother { name }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "parent" conflict because "mother" and "father" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });

  it('reports one conflict when both parent calls and children conflict', () => {
    expectErrors(`
      fragment mixedParents on Dog {
        parent: mother {
          value: name
        }
        parent: mother {
          value: mother { name }
        }
        parent: father { name }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "parent" conflict because "mother" and "father" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 9, column: 9 },
        ],
      },
    ]);
  });

  it('reports one conflict when both streams and children conflict', () => {
    expectErrors(`
      fragment streamBarrier on Dog {
        parent: mother @stream { value: name }
        parent: mother { value: father }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "value" conflict because "name" and "father" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 34 },
          { line: 4, column: 26 },
        ],
      },
    ]);
  });

  it('very deep conflict', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
        },
        field {
          deepField {
            x: b
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 5, column: 13 },
          { line: 10, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflicts at the leaf nodes', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
          deepField {
            x: b
          }
        },
        field {
          deepField {
            y
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 5, column: 13 },
          { line: 8, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflicts at leaf nodes in fragments', () => {
    expectErrors(`
      {
        field {
          ...F
        }
        field {
          ...F
        }
      }
      fragment F on T {
        deepField {
          deeperField {
            x: a
          }
          deeperField {
            x: b
          }
        },
        deepField {
          deeperField {
            y
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 13, column: 13 },
          { line: 16, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict in nested fragments', () => {
    expectErrors(`
      {
        field {
          ...I
        }
        field {
          ...F
        }
      }
      fragment F on T {
        x: a
        ...G
      }
      fragment G on T {
        y: c
      }
      fragment I on T {
        y: d
        ...J
      }
      fragment J on T {
        x: b
      }
    `).toDeepEqual([
      {
        message:
          'Fields "y" conflict because "d" and "c" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 18, column: 9 },
          { line: 15, column: 9 },
        ],
      },
    ]);
  });

  it('reports deep conflict after nested fragments', () => {
    expectErrors(`
      fragment F on T {
        ...G
      }
      fragment G on T {
        ...H
      }
      fragment H on T {
        x: a
      }
      {
        x: b
        ...F
      }
    `).toDeepEqual([
      {
        message:
          'Fields "x" conflict because "b" and "a" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 12, column: 9 },
          { line: 9, column: 9 },
        ],
      },
    ]);
  });

  it('ignores unknown fragments', () => {
    expectValid(`
      {
        field
        ...Unknown
        ...Known
      }

      fragment Known on T {
        field
        ...OtherUnknown
      }
    `);
  });

  describe('return types must be unambiguous', () => {
    const schema = buildSchema(`
      interface SomeBox {
        deepBox: SomeBox
        unrelatedField: String
      }

      type StringBox implements SomeBox {
        scalar: String
        deepBox: StringBox
        unrelatedField: String
        listNode: [Node]
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      type IntBox implements SomeBox {
        scalar: Int
        deepBox: IntBox
        unrelatedField: String
        node: Node
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      interface NonNullStringBox1 {
        scalar: String!
      }

      type NonNullStringBox1Impl implements SomeBox & NonNullStringBox1 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      interface NonNullStringBox2 {
        scalar: String!
      }

      type NonNullStringBox2Impl implements SomeBox & NonNullStringBox2 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      type Connection {
        edges: [Edge]
      }

      type Edge {
        node: Node
      }

      type Node {
        id: ID
        name: String
      }

      type Query {
        someBox: SomeBox
        connection: Connection
      }
    `);

    it('conflicting return types which potentially overlap', () => {
      // This is invalid since an object could potentially be both the Object
      // type IntBox and the interface type NonNullStringBox1. While that
      // condition does not exist in the current schema, the schema could
      // expand in the future to allow this. Thus it is invalid.
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ...on IntBox {
                scalar
              }
              ...on NonNullStringBox1 {
                scalar
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "Int" and "String!". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('compatible return shapes on different return types', () => {
      // In this case `deepBox` returns `SomeBox` in the first usage, and
      // `StringBox` in the second usage. These return types are not the same!
      // however this is valid because the return *shapes* are compatible.
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on SomeBox {
                deepBox {
                  unrelatedField
                }
              }
              ... on StringBox {
                deepBox {
                  unrelatedField
                }
              }
            }
          }
        `,
      );
    });

    it('disallows differing return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "Int" and "String". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('does not compare subfields after a response-type conflict', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on StringBox {
                parent: listNode { value: name }
              }
              ... on IntBox {
                parent: node { value: id }
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "parent" conflict because they return conflicting types "[Node]" and "Node". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('reports correctly when a non-exclusive follows an exclusive', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            memoed: someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            memoed: someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            other: someBox {
              ...X
            }
            other: someBox {
              ...Y
            }
          }
          fragment X on SomeBox {
            scalar
          }
          fragment Y on SomeBox {
            scalar: unrelatedField
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "scalar" conflict because "scalar" and "unrelatedField" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 39, column: 13 },
            { line: 42, column: 13 },
          ],
        },
      ]);
    });

    it('disallows differing return type nullability despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on NonNullStringBox1 {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "String!" and "String". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('disallows differing return type list despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: listStringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: stringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "box" conflict because they return conflicting types "[StringBox]" and "StringBox". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 10, column: 17 },
          ],
        },
      ]);

      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: listStringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "box" conflict because they return conflicting types "StringBox" and "[StringBox]". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 10, column: 17 },
          ],
        },
      ]);
    });

    it('disallows differing subfields', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  val: scalar
                  val: unrelatedField
                }
              }
              ... on StringBox {
                box: stringBox {
                  val: scalar
                }
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "val" conflict because "scalar" and "unrelatedField" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 6, column: 19 },
            { line: 7, column: 19 },
          ],
        },
      ]);
    });

    it('disallows differing deep return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: intBox {
                  scalar
                }
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "String" and "Int". Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 6, column: 19 },
            { line: 11, column: 19 },
          ],
        },
      ]);
    });

    it('allows non-conflicting overlapping types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar: unrelatedField
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      );
    });

    it('same wrapped scalar return types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on NonNullStringBox1 {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('allows inline fragments without type condition', () => {
      expectValidWithSchema(
        schema,
        `
          {
            a
            ... {
              a
            }
          }
        `,
      );
    });

    it('compares deep types including list', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            connection {
              ...edgeID
              edges {
                node {
                  id: name
                }
              }
            }
          }

          fragment edgeID on Connection {
            edges {
              node {
                id
              }
            }
          }
        `,
      ).toDeepEqual([
        {
          message:
            'Fields "id" conflict because "name" and "id" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 7, column: 19 },
            { line: 16, column: 17 },
          ],
        },
      ]);
    });

    it('ignores unknown types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on UnknownType {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('works for field names that are JS keywords', () => {
      const schemaWithKeywords = buildSchema(`
        type Foo {
          constructor: String
        }

        type Query {
          foo: Foo
        }
      `);

      expectValidWithSchema(
        schemaWithKeywords,
        `
          {
            foo {
              constructor
            }
          }
        `,
      );
    });
  });

  it('does not infinite loop on recursive fragment', () => {
    expectValid(`
      {
        ...fragA
      }

      fragment fragA on Human { name, relatives { name, ...fragA } }
    `);
  });

  it('does not infinite loop on immediately recursive fragment', () => {
    expectValid(`
      {
        ...fragA
      }

      fragment fragA on Human { name, ...fragA }
    `);
  });

  it('does not infinite loop on recursive fragment with a field named after fragment', () => {
    expectValid(`
      {
        ...fragA
        fragA
      }

      fragment fragA on Query { ...fragA }
    `);
  });

  it('finds invalid cases even with field named after fragment', () => {
    expectErrors(`
      {
        fragA
        ...fragA
      }

      fragment fragA on Type {
        fragA: b
      }
    `).toDeepEqual([
      {
        message:
          'Fields "fragA" conflict because "fragA" and "b" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 8, column: 9 },
        ],
      },
    ]);
  });

  it('does not infinite loop on transitively recursive fragment', () => {
    expectValid(`
      {
        ...fragA
        fragB
      }

      fragment fragA on Human { name, ...fragB }
      fragment fragB on Human { name, ...fragC }
      fragment fragC on Human { name, ...fragA }
    `);
  });

  it('finds invalid case even with immediately recursive fragment', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        ...sameAliasesWithDifferentFieldTargets
        fido: name
        fido: nickname
      }
    `).toDeepEqual([
      {
        message:
          'Fields "fido" conflict because "name" and "nickname" are different fields. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        locations: [
          { line: 4, column: 9 },
          { line: 5, column: 9 },
        ],
      },
    ]);
  });

  it('does not infinite loop on recursive fragments separated by fields', () => {
    expectValid(`
      {
        ...fragA
        ...fragB
      }

      fragment fragA on T {
        x {
          ...fragA
          x {
            ...fragA
          }
        }
      }

      fragment fragB on T {
        x {
          ...fragB
          x {
            ...fragB
          }
        }
      }
    `);
  });

  describe('fragment arguments must produce fields that can be merged', () => {
    it('ignores argument order and undeclared fragment arguments', () => {
      expectValid(`
        query Query($x: Int, $y: Int) {
          ...WithArgs(y: $y, x: $x, ignored: true)
          ...WithArgs(x: $x, y: $y)
        }
        fragment WithArgs($y: Int, $x: Int) on Type {
          a(x: $x)
          b(y: $y)
        }
      `);
    });

    it('allows conflicting spreads at different depths', () => {
      expectValid(`
        query ValidDifferingFragmentArgs($command1: DogCommand, $command2: DogCommand) {
          dog {
            ...DoesKnowCommand(command: $command1)
            mother {
              ...DoesKnowCommand(command: $command2)
            }
          }
        }
        fragment DoesKnowCommand($command: DogCommand) on Dog {
          doesKnowCommand(dogCommand: $command)
        }
      `);
    });

    it('encounters conflict in fragments', () => {
      expectErrors(`
        {
          ...WithArgs(x: 3)
          ...WithArgs(x: 4)
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Spreads "WithArgs" conflict because WithArgs(x: 3) and WithArgs(x: 4) have different fragment arguments.',
          locations: [
            { line: 3, column: 11 },
            { line: 4, column: 11 },
          ],
        },
      ]);
    });

    it('reports a fragment argument conflict once when spreads are reversed', () => {
      expectErrors(`
        query First {
          ...WithArgs(x: 3)
          ...WithArgs(x: 4)
        }
        query Second {
          ...WithArgs(x: 4)
          ...WithArgs(x: 3)
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Spreads "WithArgs" conflict because WithArgs(x: 3) and WithArgs(x: 4) have different fragment arguments.',
          locations: [
            { line: 3, column: 11 },
            { line: 4, column: 11 },
          ],
        },
      ]);
    });

    it('checks fragment arguments in each variable scope', () => {
      for (const definition of [
        'fragment Outer($x: Int, $y: Int) on Type',
        'query Example($x: Int, $y: Int)',
      ]) {
        expectErrors(`
        ${definition} {
          ...WithArgs(x: $x)
          ...WithArgs(x: $y)
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
          {
            message:
              'Spreads "WithArgs" conflict because WithArgs(x: $x) and WithArgs(x: $y) have different fragment arguments.',
            locations: [
              { line: 3, column: 11 },
              { line: 4, column: 11 },
            ],
          },
        ]);
      }
    });

    it('allows operations with overlapping fields with arguments using identical operation variables', () => {
      expectValid(`
        query ($y: Int = 1) {
          a(x: $y)
          ...WithArgs(x: 1)
        }
        fragment WithArgs($x: Int = 1) on Type {
          a(x: $y)
        }
      `);
    });

    it('rejects overlapping fields whose variables have different definitions', () => {
      expectErrors(`
        query ($y: Int = 1) {
          a(x: $y)
          ...WithArgs(x: $y)
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "a" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 3, column: 11 },
            { line: 7, column: 11 },
          ],
        },
      ]);
    });

    it('rejects overlapping fields with different nested variable definitions', () => {
      expectErrors(`
        query ($z: Int = 1) {
          a(x: $z)
          ...WithArgs(y: $z)
        }
        fragment WithArgs($y: Int) on Type {
          ...NestedWithArgs(x: $y)
        }
        fragment NestedWithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "a" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 3, column: 11 },
            { line: 10, column: 11 },
          ],
        },
      ]);
    });

    it('rejects a fragment variable even when its default matches a literal', () => {
      expectErrors(`
        query {
          a(x: 1)
          ...WithArgs
        }
        fragment WithArgs($x: Int = 1) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "a" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 3, column: 11 },
            { line: 7, column: 11 },
          ],
        },
      ]);
    });

    it('keeps an omitted fragment variable distinct from a shadowed operation variable', () => {
      expectErrors(`
        query ($x: Int) {
          a(x: $x)
          ...WithArgs
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "a" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 3, column: 11 },
            { line: 7, column: 11 },
          ],
        },
      ]);
    });

    it('raises errors with overlapping fields with arguments that conflict via operation variables even with defaults and fragment variable defaults', () => {
      expectErrors(`
        query ($y: Int = 1) {
          a(x: $y)
          ...WithArgs
        }
        fragment WithArgs($x: Int = 1) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "a" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 3, column: 11 },
            { line: 7, column: 11 },
          ],
        },
      ]);
    });

    it('rejects overlapping fields using list variables with different definitions', () => {
      expectErrors(`
        query Query($stringListVarY: [String]) {
          complicatedArgs {
            stringListArgField(stringListArg: $stringListVarY)
            ...WithArgs(stringListVarX: $stringListVarY)
          }
        }
        fragment WithArgs($stringListVarX: [String]) on Type {
          stringListArgField(stringListArg: $stringListVarX)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "stringListArgField" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 4, column: 13 },
            { line: 9, column: 11 },
          ],
        },
      ]);
    });

    it('rejects nested list values with different variable definitions', () => {
      expectErrors(`
        query Query($stringListVarY: [String]) {
          complicatedArgs {
            stringListArgField(stringListArg: [$stringListVarY, "fixed"])
            ...WithArgs(stringListVarX: $stringListVarY)
          }
        }
        fragment WithArgs($stringListVarX: [String]) on Type {
          stringListArgField(stringListArg: [$stringListVarX, "fixed"])
        }
      `).toDeepEqual([
        {
          message:
            'Fields "stringListArgField" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 4, column: 13 },
            { line: 9, column: 11 },
          ],
        },
      ]);
    });

    it('rejects overlapping fields using input object variables with different definitions', () => {
      expectErrors(`
        query Query($complexVarY: ComplexInput) {
          complicatedArgs {
            complexArgField(complexArg: $complexVarY)
            ...WithArgs(complexVarX: $complexVarY)
          }
        }
        fragment WithArgs($complexVarX: ComplexInput) on Type {
          complexArgField(complexArg: $complexVarX)
        }
      `).toDeepEqual([
        {
          message:
            'Fields "complexArgField" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 4, column: 13 },
            { line: 9, column: 11 },
          ],
        },
      ]);
    });

    it('rejects nested input values with different variable definitions', () => {
      expectErrors(`
        query Query($boolVarY: Boolean) {
          complicatedArgs {
            complexArgField(complexArg: {requiredArg: $boolVarY})
            ...WithArgs(boolVarX: $boolVarY)
          }
        }
        fragment WithArgs($boolVarX: Boolean) on Type {
          complexArgField(complexArg: {requiredArg: $boolVarX})
        }
      `).toDeepEqual([
        {
          message:
            'Fields "complexArgField" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 4, column: 13 },
            { line: 9, column: 11 },
          ],
        },
      ]);
    });

    it('rejects fragment spreads whose variables have different definitions', () => {
      expectErrors(`
        query Query($value: Int) {
          ...A(value: $value)
          ...B(value: $value)
        }
        fragment A($value: Int) on Type {
          ...Shared(size: $value)
        }
        fragment B($value: Int) on Type {
          ...Shared(size: $value)
        }
        fragment Shared($size: Int) on Type {
          a(x: $size)
        }
      `).toDeepEqual([
        {
          message:
            'Spreads "Shared" conflict because Shared(size: $value) and Shared(size: $value) have different fragment arguments.',
          locations: [
            { line: 7, column: 11 },
            { line: 10, column: 11 },
          ],
        },
      ]);
    });

    it('allows repeated spreads with the same local variable definitions', () => {
      expectValid(`
        query Query($size: Int) {
          ...Wrapper(size: $size)
          ...Wrapper(size: $size)
        }
        fragment Wrapper($size: Int) on Type {
          a(x: $size)
        }
      `);
    });

    it('compares a shared selection set in distinct variable scopes', () => {
      const schema = buildSchema(
        'type Query { child: Query, value(arg: Int): Int }',
      );
      const document = parse(
        `
          query ($x: Int) {
            child { value(arg: $x) }
            child { ...Local(x: 1) }
          }
          fragment Local($x: Int) on Query { value(arg: $x) }
        `,
        { experimentalFragmentArguments: true },
      );
      const [operation] = document.definitions.filter(
        (definition) => definition.kind === Kind.OPERATION_DEFINITION,
      );
      const [field] = operation.selectionSet.selections.filter(
        (selection) => selection.kind === Kind.FIELD,
      );
      const sharedDocument = {
        ...document,
        definitions: document.definitions.map((definition) =>
          definition.kind === Kind.FRAGMENT_DEFINITION
            ? {
                ...definition,
                selectionSet: field.selectionSet as SelectionSetNode,
              }
            : definition,
        ),
      };
      for (const ast of [document, sharedDocument]) {
        expect(
          validate(schema, ast).map((error) => error.message),
        ).to.deep.equal([
          'Fields "value" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
        ]);
      }
    });

    it('encounters nested field conflict in fragments that could otherwise merge', () => {
      expectErrors(`
        query ValidDifferingFragmentArgs($command1: DogCommand, $command2: DogCommand) {
          dog {
            ...DoesKnowCommandNested(command: $command1)
            mother {
              ...DoesKnowCommandNested(command: $command2)
            }
          }
        }
        fragment DoesKnowCommandNested($command: DogCommand) on Dog {
          doesKnowCommand(dogCommand: $command)
          mother {
            doesKnowCommand(dogCommand: $command)
          }
        }
      `).toDeepEqual([
        {
          message:
            'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields or their ancestors to fetch both if this was intentional.',
          locations: [
            { line: 13, column: 13 },
            { line: 11, column: 11 },
          ],
        },
      ]);
    });

    it('encounters nested conflict in fragments', () => {
      expectErrors(`
        {
          connection {
            edges {
              ...WithArgs(x: 3)
            }
          }
          ...Connection
        }
        fragment Connection on Type {
          connection {
            edges {
              ...WithArgs(x: 4)
            }
          }
        }
        fragment WithArgs($x: Int) on Type {
          a(x: $x)
        }
      `).toDeepEqual([
        {
          message:
            'Spreads "WithArgs" conflict because WithArgs(x: 3) and WithArgs(x: 4) have different fragment arguments.',
          locations: [
            {
              column: 15,
              line: 5,
            },
            {
              column: 15,
              line: 13,
            },
          ],
        },
      ]);
    });
  });
});
