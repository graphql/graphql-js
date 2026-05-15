/** @category Validation Context */

import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';

import type { GraphQLError } from '../error/GraphQLError.ts';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  VariableNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type { ASTVisitor } from '../language/visitor.ts';
import { visit } from '../language/visitor.ts';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import type { FragmentSignature } from '../utilities/TypeInfo.ts';
import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo.ts';

type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
interface VariableUsage {
  readonly node: VariableNode;
  readonly type: Maybe<GraphQLInputType>;
  readonly parentType: Maybe<GraphQLInputType>;
  readonly defaultValue: unknown;
  readonly fragmentVariableDefinition: Maybe<VariableDefinitionNode>;
}

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 *
 * @internal
 */
export class ASTValidationContext {
  private _ast: DocumentNode;
  private _onError: (error: GraphQLError) => void;
  private _fragments: ObjMap<FragmentDefinitionNode> | undefined;
  private _fragmentSpreads: Map<SelectionSetNode, Array<FragmentSpreadNode>>;
  private _recursivelyReferencedFragments: Map<
    OperationDefinitionNode,
    Array<FragmentDefinitionNode>
  >;

  constructor(ast: DocumentNode, onError: (error: GraphQLError) => void) {
    this._ast = ast;
    this._fragments = undefined;
    this._fragmentSpreads = new Map();
    this._recursivelyReferencedFragments = new Map();
    this._onError = onError;
  }

  get [Symbol.toStringTag](): string {
    return 'ASTValidationContext';
  }

  reportError(error: GraphQLError): void {
    this._onError(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }

  getFragment(name: string): Maybe<FragmentDefinitionNode> {
    let fragments: ObjMap<FragmentDefinitionNode>;
    if (this._fragments) {
      fragments = this._fragments;
    } else {
      fragments = Object.create(null);
      for (const defNode of this.getDocument().definitions) {
        if (defNode.kind === Kind.FRAGMENT_DEFINITION) {
          fragments[defNode.name.value] = defNode;
        }
      }
      this._fragments = fragments;
    }
    return fragments[name];
  }

  getFragmentSpreads(
    node: SelectionSetNode,
  ): ReadonlyArray<FragmentSpreadNode> {
    let spreads = this._fragmentSpreads.get(node);
    if (!spreads) {
      spreads = [];
      const setsToVisit: Array<SelectionSetNode> = [node];
      let set: SelectionSetNode | undefined;
      while ((set = setsToVisit.pop())) {
        for (const selection of set.selections) {
          if (selection.kind === Kind.FRAGMENT_SPREAD) {
            spreads.push(selection);
          } else if (selection.selectionSet) {
            setsToVisit.push(selection.selectionSet);
          }
        }
      }
      this._fragmentSpreads.set(node, spreads);
    }
    return spreads;
  }

  getRecursivelyReferencedFragments(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<FragmentDefinitionNode> {
    let fragments = this._recursivelyReferencedFragments.get(operation);
    if (!fragments) {
      fragments = [];
      const collectedNames = new Set<string>();
      const nodesToVisit: Array<SelectionSetNode> = [operation.selectionSet];
      let node: SelectionSetNode | undefined;
      while ((node = nodesToVisit.pop())) {
        for (const spread of this.getFragmentSpreads(node)) {
          const fragName = spread.name.value;
          if (!collectedNames.has(fragName)) {
            collectedNames.add(fragName);
            const fragment = this.getFragment(fragName);
            if (fragment) {
              fragments.push(fragment);
              nodesToVisit.push(fragment.selectionSet);
            }
          }
        }
      }
      this._recursivelyReferencedFragments.set(operation, fragments);
    }
    return fragments;
  }
}

/** @internal */
export type ASTValidationRule = (context: ASTValidationContext) => ASTVisitor;

/** @internal */
export class SDLValidationContext extends ASTValidationContext {
  private _schema: Maybe<GraphQLSchema>;

  constructor(
    ast: DocumentNode,
    schema: Maybe<GraphQLSchema>,
    onError: (error: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
  }

  get hideSuggestions(): boolean {
    return false;
  }

  override get [Symbol.toStringTag](): string {
    return 'SDLValidationContext';
  }

  getSchema(): Maybe<GraphQLSchema> {
    return this._schema;
  }
}

/** @internal */
export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;

/** Validation context passed to query validation rules. */
export class ValidationContext extends ASTValidationContext {
  private _schema: GraphQLSchema;
  private _typeInfo: TypeInfo;
  private _variableUsages: Map<
    NodeWithSelectionSet,
    ReadonlyArray<VariableUsage>
  >;

  private _recursiveVariableUsages: Map<
    OperationDefinitionNode,
    ReadonlyArray<VariableUsage>
  >;
  private _hideSuggestions: boolean;

  /**
   * Creates a ValidationContext instance.
   * @param schema - Schema used to validate the document.
   * @param ast - Document AST being validated.
   * @param typeInfo - TypeInfo instance used to track traversal state.
   * @param onError - Callback invoked for each validation error.
   * @param hideSuggestions - Whether suggestion text should be omitted from errors.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { GraphQLError } from 'graphql/error';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const errors = [];
   * const context = new ValidationContext(
   *   schema,
   *   document,
   *   new TypeInfo(schema),
   *   (error) => errors.push(error),
   * );
   *
   * context.reportError(new GraphQLError('Example validation error.'));
   *
   * context.getSchema(); // => schema
   * errors[0].message; // => 'Example validation error.'
   * ```
   */
  constructor(
    schema: GraphQLSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (error: GraphQLError) => void,
    hideSuggestions?: Maybe<boolean>,
  ) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
    this._hideSuggestions = hideSuggestions ?? false;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  override get [Symbol.toStringTag](): string {
    return 'ValidationContext';
  }

  /**
   * Returns whether validation error suggestions are hidden.
   * @returns True when suggestion text should be omitted from errors.
   */
  get hideSuggestions(): boolean {
    return this._hideSuggestions;
  }

  /**
   * Returns the schema being used by this validation context.
   * @returns The schema being validated against.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const context = new ValidationContext(
   *   schema,
   *   parse('{ greeting }'),
   *   new TypeInfo(schema),
   *   () => {},
   * );
   *
   * context.getSchema().getQueryType()?.name; // => 'Query'
   * ```
   */
  getSchema(): GraphQLSchema {
    return this._schema;
  }

  /**
   * Returns variable usages found directly within this node.
   * @param node - The AST node to inspect or visit.
   * @returns Variable usages found directly within this node.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting(name: String): String
   *   }
   * `);
   * const document = parse('query ($name: String) { greeting(name: $name) }');
   * const operation = document.definitions[0];
   * const context = new ValidationContext(
   *   schema,
   *   document,
   *   new TypeInfo(schema),
   *   () => {},
   * );
   *
   * const usages = context.getVariableUsages(operation);
   *
   * usages[0].node.name.value; // => 'name'
   * String(usages[0].type); // => 'String'
   * ```
   */
  getVariableUsages(node: NodeWithSelectionSet): ReadonlyArray<VariableUsage> {
    let usages = this._variableUsages.get(node);
    if (!usages) {
      const newUsages: Array<VariableUsage> = [];
      const typeInfo = new TypeInfo(
        this._schema,
        undefined,
        this._typeInfo.getFragmentSignatureByName(),
      );
      const fragmentDefinition =
        node.kind === Kind.FRAGMENT_DEFINITION ? node : undefined;
      visit(
        node,
        visitWithTypeInfo(typeInfo, {
          VariableDefinition: () => false,
          Variable(variable) {
            let fragmentVariableDefinition;
            if (fragmentDefinition) {
              const fragmentSignature = typeInfo.getFragmentSignatureByName()(
                fragmentDefinition.name.value,
              );

              fragmentVariableDefinition =
                fragmentSignature?.variableDefinitions.get(variable.name.value);
              newUsages.push({
                node: variable,
                type: typeInfo.getInputType(),
                parentType: typeInfo.getParentInputType(),
                defaultValue: undefined, // fragment variables have a variable default but no location default, which is what this default value represents
                fragmentVariableDefinition,
              });
            } else {
              newUsages.push({
                node: variable,
                type: typeInfo.getInputType(),
                parentType: typeInfo.getParentInputType(),
                defaultValue: typeInfo.getDefaultValue(),
                fragmentVariableDefinition: undefined,
              });
            }
          },
        }),
      );
      usages = newUsages;
      this._variableUsages.set(node, usages);
    }
    return usages;
  }

  /**
   * Returns variable usages for an operation, including variables used by referenced fragments.
   * @param operation - Operation definition to inspect.
   * @returns Variable usages reachable from the operation.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { buildSchema, TypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     viewer: User
   *   }
   *
   *   type User {
   *     name(prefix: String): String
   *   }
   * `);
   * const document = parse(`
   *   query ($prefix: String) {
   *     viewer {
   *       ...UserName
   *     }
   *   }
   *
   *   fragment UserName on User {
   *     name(prefix: $prefix)
   *   }
   * `);
   * const operation = document.definitions[0];
   * const context = new ValidationContext(
   *   schema,
   *   document,
   *   new TypeInfo(schema),
   *   () => {},
   * );
   *
   * const usages = context.getRecursiveVariableUsages(operation);
   *
   * usages.map((usage) => usage.node.name.value); // => ['prefix']
   * ```
   */
  getRecursiveVariableUsages(
    operation: OperationDefinitionNode,
  ): ReadonlyArray<VariableUsage> {
    let usages = this._recursiveVariableUsages.get(operation);
    if (!usages) {
      usages = this.getVariableUsages(operation);
      for (const frag of this.getRecursivelyReferencedFragments(operation)) {
        usages = usages.concat(this.getVariableUsages(frag));
      }
      this._recursiveVariableUsages.set(operation, usages);
    }
    return usages;
  }

  /**
   * Returns the current output type at this point in traversal.
   * @returns The current output type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let typeName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Field: () => {
   *       typeName = String(context.getType());
   *     },
   *   }),
   * );
   *
   * typeName; // => 'String'
   * ```
   */
  getType(): Maybe<GraphQLOutputType> {
    return this._typeInfo.getType();
  }

  /**
   * Returns the current parent composite type.
   * @returns The current parent composite type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let parentTypeName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Field: () => {
   *       parentTypeName = context.getParentType()?.name;
   *     },
   *   }),
   * );
   *
   * parentTypeName; // => 'Query'
   * ```
   */
  getParentType(): Maybe<GraphQLCompositeType> {
    return this._typeInfo.getParentType();
  }

  /**
   * Returns the current input type at this point in traversal.
   * @returns The current input type, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     reviews(limit: Int): [String]
   *   }
   * `);
   * const document = parse('{ reviews(limit: 5) }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let inputTypeName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Argument: () => {
   *       inputTypeName = String(context.getInputType());
   *     },
   *   }),
   * );
   *
   * inputTypeName; // => 'Int'
   * ```
   */
  getInputType(): Maybe<GraphQLInputType> {
    return this._typeInfo.getInputType();
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
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   input ReviewFilter {
   *     stars: Int
   *   }
   *
   *   type Query {
   *     reviews(filter: ReviewFilter): [String]
   *   }
   * `);
   * const document = parse('{ reviews(filter: { stars: 5 }) }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let parentInputTypeName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     ObjectField: () => {
   *       parentInputTypeName = String(context.getParentInputType());
   *     },
   *   }),
   * );
   *
   * parentInputTypeName; // => 'ReviewFilter'
   * ```
   */
  getParentInputType(): Maybe<GraphQLInputType> {
    return this._typeInfo.getParentInputType();
  }

  /**
   * Returns the current field definition.
   * @returns The current field definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let fieldName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Field: () => {
   *       fieldName = context.getFieldDef()?.name;
   *     },
   *   }),
   * );
   *
   * fieldName; // => 'greeting'
   * ```
   */
  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    return this._typeInfo.getFieldDef();
  }

  /**
   * Returns the current directive definition.
   * @returns The current directive definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     greeting: String
   *   }
   * `);
   * const document = parse('{ greeting @include(if: true) }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let directiveName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Directive: () => {
   *       directiveName = context.getDirective()?.name;
   *     },
   *   }),
   * );
   *
   * directiveName; // => 'include'
   * ```
   */
  getDirective(): Maybe<GraphQLDirective> {
    return this._typeInfo.getDirective();
  }

  /**
   * Returns the current argument definition.
   * @returns The current argument definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   type Query {
   *     reviews(limit: Int): [String]
   *   }
   * `);
   * const document = parse('{ reviews(limit: 5) }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let argumentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Argument: () => {
   *       argumentName = context.getArgument()?.name;
   *     },
   *   }),
   * );
   *
   * argumentName; // => 'limit'
   * ```
   */
  getArgument(): Maybe<GraphQLArgument> {
    return this._typeInfo.getArgument();
  }

  /**
   * Returns the fragment signature at the current traversal position.
   * @returns The current fragment signature, if one is active.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
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
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let fragmentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     FragmentSpread: () => {
   *       fragmentName = context.getFragmentSignature()?.definition.name.value;
   *     },
   *   }),
   * );
   *
   * fragmentName; // => 'GreetingFields'
   * ```
   */
  getFragmentSignature(): Maybe<FragmentSignature> {
    return this._typeInfo.getFragmentSignature();
  }

  /**
   * Returns the function used to look up fragment signatures by name.
   * @returns A function that maps fragment names to fragment signatures.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
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
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let fragmentName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     Document: () => {
   *       const getFragmentSignature = context.getFragmentSignatureByName();
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
    return this._typeInfo.getFragmentSignatureByName();
  }

  /**
   * Returns the current enum value definition.
   * @returns The current enum value definition, if known.
   * @example
   * ```ts
   * import { parse, visit } from 'graphql/language';
   * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
   * import { ValidationContext } from 'graphql/validation';
   *
   * const schema = buildSchema(`
   *   enum Sort {
   *     NEWEST
   *     OLDEST
   *   }
   *
   *   type Query {
   *     reviews(sort: Sort): [String]
   *   }
   * `);
   * const document = parse('{ reviews(sort: OLDEST) }');
   * const typeInfo = new TypeInfo(schema);
   * const context = new ValidationContext(schema, document, typeInfo, () => {});
   * let enumValueName;
   *
   * visit(
   *   document,
   *   visitWithTypeInfo(typeInfo, {
   *     EnumValue: () => {
   *       enumValueName = context.getEnumValue()?.name;
   *     },
   *   }),
   * );
   *
   * enumValueName; // => 'OLDEST'
   * ```
   */
  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._typeInfo.getEnumValue();
  }
}

/** A function that creates an AST visitor for validating a GraphQL document. */
export type ValidationRule = (context: ValidationContext) => ASTVisitor;
