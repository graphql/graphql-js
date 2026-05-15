/** @category Type Info */

import type { Maybe } from '../jsutils/Maybe.ts';

import type {
  ASTNode,
  DocumentNode,
  FragmentDefinitionNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { isNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type { ASTVisitor } from '../language/visitor.ts';
import { getEnterLeaveForKind } from '../language/visitor.ts';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLType,
} from '../type/definition.ts';
import {
  getNamedType,
  getNullableType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isListType,
  isObjectType,
  isOutputType,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import { typeFromAST } from './typeFromAST.ts';

/** @internal */
export interface FragmentSignature {
  readonly definition: FragmentDefinitionNode;
  readonly variableDefinitions: Map<string, VariableDefinitionNode>;
}

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  private _schema: GraphQLSchema;
  private _typeStack: Array<Maybe<GraphQLOutputType>>;
  private _parentTypeStack: Array<Maybe<GraphQLCompositeType>>;
  private _inputTypeStack: Array<Maybe<GraphQLInputType>>;
  private _fieldDefStack: Array<Maybe<GraphQLField<unknown, unknown>>>;
  private _defaultValueStack: Array<unknown>;
  private _directive: Maybe<GraphQLDirective>;
  private _argument: Maybe<GraphQLArgument>;
  private _enumValue: Maybe<GraphQLEnumValue>;
  private _fragmentSignaturesByName: (
    fragmentName: string,
  ) => Maybe<FragmentSignature>;

  private _fragmentSignature: Maybe<FragmentSignature>;
  private _fragmentArgument: Maybe<VariableDefinitionNode>;

  /**
   * Creates a TypeInfo instance.
   * @param schema - Schema used for type lookups.
   * @param initialType - Optional type to use at the start of traversal.
   * @param fragmentSignatures - Fragment signatures available during traversal.
   * @example
   * ```ts
   * // Track field types during a visitWithTypeInfo traversal.
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema } from 'graphql/utilities';
   * import { TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * const seenTypes = [];
   *
   * visit(
   *   parse('{ greeting }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Field: () => {
   *       seenTypes.push(String(typeInfo.getType()));
   *     },
   *   }),
   * );
   *
   * seenTypes; // => ['String']
   * ```
   * @example
   * ```ts
   * // This variant starts from an initial type and supplies fragment signatures.
   * import { Kind, parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting(name: String): String
   *   }
   * `);
   * const fragmentDocument = parse(
   *   'fragment GreetingFields($name: String) on Query { greeting(name: $name) }',
   *   { experimentalFragmentArguments: true },
   * );
   * const fragmentDefinition = fragmentDocument.definitions[0];
   * const variableDefinition = fragmentDefinition.variableDefinitions[0];
   * const typeInfo = new TypeInfo(schema, schema.getQueryType(), (name) =>
   *   name === 'GreetingFields'
   *     ? {
   *         definition: fragmentDefinition,
   *         variableDefinitions: new Map([ ['name', variableDefinition] ]),
   *       }
   *     : undefined,
   * );
   *
   * typeInfo.enter({
   *   kind: Kind.SELECTION_SET,
   *   selections: [],
   * });
   * typeInfo.enter({
   *   kind: Kind.FRAGMENT_SPREAD,
   *   name: { kind: Kind.NAME, value: 'GreetingFields' },
   *   arguments: [],
   *   directives: [],
   * });
   *
   * String(typeInfo.getParentType()); // => 'Query'
   * typeInfo.getFragmentSignature()?.definition.name.value; // => 'GreetingFields'
   * ```
   */
  constructor(
    schema: GraphQLSchema,
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     * beginning somewhere other than documents.
     */
    initialType?: Maybe<GraphQLType>,
    fragmentSignatures?: Maybe<
      (fragmentName: string) => Maybe<FragmentSignature>
    >,
  ) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directive = null;
    this._argument = null;
    this._enumValue = null;
    this._fragmentSignaturesByName = fragmentSignatures ?? (() => null);
    this._fragmentSignature = null;
    this._fragmentArgument = null;
    if (initialType) {
      if (isInputType(initialType)) {
        this._inputTypeStack.push(initialType);
      }
      if (isCompositeType(initialType)) {
        this._parentTypeStack.push(initialType);
      }
      if (isOutputType(initialType)) {
        this._typeStack.push(initialType);
      }
    }
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'TypeInfo';
  }

  /**
   * Returns the current output type at this point in traversal.
   * @returns The current output type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     viewer: User
   *   }
   *
   *   type User {
   *     name: String
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * const fieldTypes = {};
   *
   * visit(
   *   parse('{ viewer { name } }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Field: (node) => {
   *       fieldTypes[node.name.value] = String(typeInfo.getType());
   *     },
   *   }),
   * );
   *
   * fieldTypes; // => { viewer: 'User', name: 'String' }
   * ```
   */
  getType(): Maybe<GraphQLOutputType> {
    return this._typeStack.at(-1);
  }

  /**
   * Returns the current parent composite type.
   * @returns The current parent composite type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     viewer: User
   *   }
   *
   *   type User {
   *     name: String
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * const parentTypes = {};
   *
   * visit(
   *   parse('{ viewer { name } }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Field: (node) => {
   *       parentTypes[node.name.value] = String(typeInfo.getParentType());
   *     },
   *   }),
   * );
   *
   * parentTypes; // => { viewer: 'Query', name: 'User' }
   * ```
   */
  getParentType(): Maybe<GraphQLCompositeType> {
    return this._parentTypeStack.at(-1);
  }

  /**
   * Returns the current input type at this point in traversal.
   * @returns The current input type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     reviews(stars: Int!, sort: Sort = NEWEST): [String]
   *   }
   *
   *   enum Sort {
   *     NEWEST
   *     OLDEST
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * const inputTypes = {};
   *
   * visit(
   *   parse('{ reviews(stars: 5, sort: OLDEST) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Argument: (node) => {
   *       inputTypes[node.name.value] = String(typeInfo.getInputType());
   *     },
   *   }),
   * );
   *
   * inputTypes; // => { stars: 'Int!', sort: 'Sort' }
   * ```
   */
  getInputType(): Maybe<GraphQLInputType> {
    return this._inputTypeStack.at(-1);
  }

  // Note: continues to expose the closest enclosing valid input type if
  // traversal descends into syntax with no corresponding GraphQL input type.
  /**
   * Returns the parent input type for the current input position.
   * @returns The parent input type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   input ReviewFilter {
   *     stars: Int!
   *   }
   *
   *   type Query {
   *     reviews(filter: ReviewFilter): [String]
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * const parentInputTypes = {};
   *
   * visit(
   *   parse('{ reviews(filter: { stars: 5 }) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     ObjectField: (node) => {
   *       parentInputTypes[node.name.value] = String(typeInfo.getParentInputType());
   *     },
   *   }),
   * );
   *
   * parentInputTypes; // => { stars: 'ReviewFilter' }
   * ```
   */
  getParentInputType(): Maybe<GraphQLInputType> {
    return this._inputTypeStack.at(-2);
  }

  /**
   * Returns the current field definition.
   * @returns The current field definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * let fieldName;
   *
   * visit(
   *   parse('{ greeting }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Field: () => {
   *       fieldName = typeInfo.getFieldDef()?.name;
   *     },
   *   }),
   * );
   *
   * fieldName; // => 'greeting'
   * ```
   */
  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    return this._fieldDefStack.at(-1);
  }

  /**
   * Returns the default input representation for the current input position.
   * @returns The current default input, if one is available.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     reviews(limit: Int = 10): [String]
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * let defaultLimit;
   *
   * visit(
   *   parse('{ reviews(limit: 5) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Argument: () => {
   *       defaultLimit = typeInfo.getDefaultValue();
   *     },
   *   }),
   * );
   *
   * defaultLimit; // => { literal: { kind: 'IntValue', value: '10' } }
   * ```
   */
  getDefaultValue(): unknown {
    return this._defaultValueStack.at(-1);
  }

  /**
   * Returns the current directive definition.
   * @returns The current directive definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * let directiveName;
   *
   * visit(
   *   parse('{ greeting @include(if: true) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Directive: () => {
   *       directiveName = typeInfo.getDirective()?.name;
   *     },
   *   }),
   * );
   *
   * directiveName; // => 'include'
   * ```
   */
  getDirective(): Maybe<GraphQLDirective> {
    return this._directive;
  }

  /**
   * Returns the current argument definition.
   * @returns The current argument definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     reviews(limit: Int = 10): [String]
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * let argumentName;
   *
   * visit(
   *   parse('{ reviews(limit: 5) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     Argument: () => {
   *       argumentName = typeInfo.getArgument()?.name;
   *     },
   *   }),
   * );
   *
   * argumentName; // => 'limit'
   * ```
   */
  getArgument(): Maybe<GraphQLArgument> {
    return this._argument;
  }

  /**
   * Returns the current fragment signature.
   * @returns The fragment signature for the current fragment definition.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse(
   *   `
   *     {
   *       ...GreetingFields
   *     }
   *
   *     fragment GreetingFields on Query {
   *       greeting
   *     }
   *   `,
   *   { experimentalFragmentArguments: true },
   * );
   * const typeInfo = new TypeInfo(schema);
   * let fragmentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     FragmentSpread: () => {
   *       fragmentName = typeInfo.getFragmentSignature()?.definition.name.value;
   *     },
   *   }),
   * );
   *
   * fragmentName; // => 'GreetingFields'
   * ```
   */
  getFragmentSignature(): Maybe<FragmentSignature> {
    return this._fragmentSignature;
  }

  /**
   * Returns the function used to look up fragment signatures by name.
   * @returns A function that maps fragment names to fragment signatures.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse(
   *   `
   *     {
   *       ...GreetingFields
   *     }
   *
   *     fragment GreetingFields on Query {
   *       greeting
   *     }
   *   `,
   *   { experimentalFragmentArguments: true },
   * );
   * const typeInfo = new TypeInfo(schema);
   * let fragmentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Document: () => {
   *       const getFragmentSignature = typeInfo.getFragmentSignatureByName();
   *       fragmentName =
   *         getFragmentSignature('GreetingFields')?.definition.name.value;
   *     },
   *   }),
   * );
   *
   * fragmentName; // => 'GreetingFields'
   * ```
   */
  getFragmentSignatureByName(): (
    fragmentName: string,
  ) => Maybe<FragmentSignature> {
    return this._fragmentSignaturesByName;
  }

  /**
   * Returns the current fragment argument definition.
   * @returns The variable definition for the current fragment argument.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting(name: String): String
   *   }
   * `);
   * const document = parse(
   *   `
   *     {
   *       ...GreetingFields(name: "Ada")
   *     }
   *
   *     fragment GreetingFields($name: String) on Query {
   *       greeting(name: $name)
   *     }
   *   `,
   *   { experimentalFragmentArguments: true },
   * );
   * const typeInfo = new TypeInfo(schema);
   * let argumentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     FragmentArgument: () => {
   *       argumentName = typeInfo.getFragmentArgument()?.variable.name.value;
   *     },
   *   }),
   * );
   *
   * argumentName; // => 'name'
   * ```
   */
  getFragmentArgument(): Maybe<VariableDefinitionNode> {
    return this._fragmentArgument;
  }

  /**
   * Returns the current enum value definition.
   * @returns The current enum value definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   enum Sort {
   *     NEWEST
   *     OLDEST
   *   }
   *
   *   type Query {
   *     reviews(sort: Sort = NEWEST): [String]
   *   }
   * `);
   * const typeInfo = new TypeInfo(schema);
   * let enumValueName;
   *
   * visit(
   *   parse('{ reviews(sort: OLDEST) }'),
   *   visitWithTypeInfo(typeInfo, {
   *     EnumValue: () => {
   *       enumValueName = typeInfo.getEnumValue()?.name;
   *     },
   *   }),
   * );
   *
   * enumValueName; // => 'OLDEST'
   * ```
   */
  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._enumValue;
  }

  /**
   * Updates this TypeInfo instance for an entered AST node.
   * @param node - AST node being entered.
   * @returns Nothing.
   * @example
   * ```ts
   * import { Kind, parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const operation = document.definitions[0];
   * const selectionSet = operation.selectionSet;
   * const field = selectionSet.selections[0];
   * const typeInfo = new TypeInfo(schema);
   *
   * typeInfo.enter(operation);
   * typeInfo.enter(selectionSet);
   * typeInfo.enter(field);
   *
   * field.kind; // => Kind.FIELD
   * typeInfo.getParentType()?.name; // => 'Query'
   * String(typeInfo.getType()); // => 'String'
   * ```
   */
  enter(node: ASTNode): void {
    const schema = this._schema;
    // Note: many of the types below are explicitly typed as "unknown" to drop
    // any assumptions of a valid schema to ensure runtime types are properly
    // checked before continuing since TypeInfo is used as part of validation
    // which occurs before guarantees of schema and document validity.
    switch (node.kind) {
      case Kind.DOCUMENT: {
        const fragmentSignatures = getFragmentSignatures(node);
        this._fragmentSignaturesByName = (fragmentName: string) =>
          fragmentSignatures.get(fragmentName);
        break;
      }
      case Kind.SELECTION_SET: {
        const namedType: unknown = getNamedType(this.getType());
        this._parentTypeStack.push(
          isCompositeType(namedType) ? namedType : undefined,
        );
        break;
      }
      case Kind.FIELD: {
        const parentType = this.getParentType();
        let fieldDef;
        let fieldType: unknown;
        if (parentType) {
          fieldDef = schema.getField(parentType, node.name.value);
          if (fieldDef) {
            fieldType = fieldDef.type;
          }
        }
        this._fieldDefStack.push(fieldDef);
        this._typeStack.push(isOutputType(fieldType) ? fieldType : undefined);
        break;
      }
      case Kind.DIRECTIVE:
        this._directive = schema.getDirective(node.name.value);
        break;
      case Kind.OPERATION_DEFINITION: {
        const rootType = schema.getRootType(node.operation);
        this._typeStack.push(isObjectType(rootType) ? rootType : undefined);
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        this._fragmentSignature = this.getFragmentSignatureByName()(
          node.name.value,
        );
        break;
      }
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType: unknown = typeConditionAST
          ? typeFromAST(schema, typeConditionAST)
          : getNamedType(this.getType());
        this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        const inputType: unknown = typeFromAST(schema, node.type);
        this._inputTypeStack.push(
          isInputType(inputType) ? inputType : undefined,
        );
        break;
      }
      case Kind.ARGUMENT: {
        let argDef;
        let argType: unknown;
        const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
        if (fieldOrDirective) {
          argDef = fieldOrDirective.args.find(
            (arg) => arg.name === node.name.value,
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._defaultValueStack.push(
          argDef?.default ?? argDef?.defaultValue ?? undefined,
        );
        this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
        break;
      }
      case Kind.FRAGMENT_ARGUMENT: {
        const fragmentSignature = this.getFragmentSignature();
        const argDef = fragmentSignature?.variableDefinitions.get(
          node.name.value,
        );
        this._fragmentArgument = argDef;
        let argType: unknown;
        if (argDef) {
          argType = typeFromAST(this._schema, argDef.type);
        }
        this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
        break;
      }
      case Kind.LIST: {
        const listType: unknown = getNullableType(this.getInputType());
        const itemType: unknown = isListType(listType)
          ? listType.ofType
          : undefined;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType: unknown = getNamedType(this.getInputType());
        let inputFieldType: GraphQLInputType | undefined;
        let inputField: GraphQLInputField | undefined;
        if (isInputObjectType(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField != null) {
            inputFieldType = inputField.type;
          }
        }
        this._defaultValueStack.push(
          inputField?.default ?? inputField?.defaultValue ?? undefined,
        );
        this._inputTypeStack.push(
          isInputType(inputFieldType) ? inputFieldType : undefined,
        );
        break;
      }
      case Kind.ENUM: {
        const enumType: unknown = getNamedType(this.getInputType());
        let enumValue;
        if (isEnumType(enumType)) {
          enumValue = enumType.getValue(node.value);
        }
        this._enumValue = enumValue;
        break;
      }
      default:
      // Ignore other nodes
    }
  }

  /**
   * Updates this TypeInfo instance for a left AST node.
   * @param node - AST node being entered.
   * @returns Nothing.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const operation = document.definitions[0];
   * const selectionSet = operation.selectionSet;
   * const field = selectionSet.selections[0];
   * const typeInfo = new TypeInfo(schema);
   *
   * typeInfo.enter(operation);
   * typeInfo.enter(selectionSet);
   * typeInfo.enter(field);
   * String(typeInfo.getType()); // => 'String'
   *
   * typeInfo.leave(field);
   * typeInfo.getType(); // => undefined
   * ```
   */
  leave(node: ASTNode): void {
    switch (node.kind) {
      case Kind.DOCUMENT:
        this._fragmentSignaturesByName = () => null;
        break;
      case Kind.SELECTION_SET:
        this._parentTypeStack.pop();
        break;
      case Kind.FIELD:
        this._fieldDefStack.pop();
        this._typeStack.pop();
        break;
      case Kind.DIRECTIVE:
        this._directive = null;
        break;
      case Kind.FRAGMENT_SPREAD:
        this._fragmentSignature = null;
        break;
      case Kind.OPERATION_DEFINITION:
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION:
        this._typeStack.pop();
        break;
      case Kind.VARIABLE_DEFINITION:
        this._inputTypeStack.pop();
        break;
      case Kind.ARGUMENT:
        this._argument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.FRAGMENT_ARGUMENT: {
        this._fragmentArgument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      }
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.ENUM:
        this._enumValue = null;
        break;
      default:
      // Ignore other nodes
    }
  }
}

function getFragmentSignatures(
  document: DocumentNode,
): Map<string, FragmentSignature> {
  const fragmentSignatures = new Map<string, FragmentSignature>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      const variableDefinitions = new Map<string, VariableDefinitionNode>();
      if (definition.variableDefinitions) {
        for (const varDef of definition.variableDefinitions) {
          variableDefinitions.set(varDef.variable.name.value, varDef);
        }
      }
      const signature = { definition, variableDefinitions };
      fragmentSignatures.set(definition.name.value, signature);
    }
  }
  return fragmentSignatures;
}

/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 * @param typeInfo - TypeInfo instance to update during traversal.
 * @param visitor - Visitor callbacks to wrap with TypeInfo updates.
 * @returns A visitor that keeps TypeInfo in sync while delegating callbacks.
 * @example
 * ```ts
 * import { parse, visit } from 'graphql/language';
 * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const typeInfo = new TypeInfo(schema);
 * const fields = [];
 *
 * visit(
 *   parse('{ greeting }'),
 *   visitWithTypeInfo(typeInfo, {
 *     Field: (node) => {
 *       fields.push({
 *         name: node.name.value,
 *         parentType: String(typeInfo.getParentType()),
 *         type: String(typeInfo.getType()),
 *       });
 *     },
 *   }),
 * );
 *
 * fields; // => [{ name: 'greeting', parentType: 'Query', type: 'String' }]
 * ```
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: ASTVisitor,
): ASTVisitor {
  return {
    enter(...args) {
      const node = args[0];
      typeInfo.enter(node);
      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
      if (fn) {
        const result = fn.apply(visitor, args);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
      let result;
      if (fn) {
        result = fn.apply(visitor, args);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}
