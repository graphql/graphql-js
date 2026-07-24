import type { Maybe } from '../../../jsutils/Maybe.ts';

import type { DirectiveNode, FieldNode } from '../../../language/ast.ts';

import type {
  GraphQLNamedType,
  GraphQLOutputType,
} from '../../../type/definition.ts';
import { isCompositeType } from '../../../type/definition.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';

import type { VariableScope } from './argumentsKey.ts';
import { argumentsKey } from './argumentsKey.ts';

interface FieldOccurrenceContext {
  addValidationWork: (work: number) => void;
  getSchema: () => GraphQLSchema;
}

/**
 * One field selection together with its parent type and lexical variable
 * scope, used to determine whether it can be merged with another selection.
 *
 * @internal
 */
export class FieldOccurrence {
  parentType: Maybe<GraphQLNamedType>;
  node: FieldNode;
  variableScope: VariableScope | undefined;
  private _context: FieldOccurrenceContext;
  private _outputType: GraphQLOutputType | null | undefined;
  private _argumentsKey: string | undefined;
  private _streamArgumentsKey: string | null | undefined;

  constructor(
    context: FieldOccurrenceContext,
    parentType: Maybe<GraphQLNamedType>,
    node: FieldNode,
    variableScope?: VariableScope,
  ) {
    this._context = context;
    this.parentType = parentType;
    this.node = node;
    this.variableScope = variableScope;
  }

  getOutputType(): GraphQLOutputType | undefined {
    if (this._outputType === undefined) {
      this._outputType =
        (isCompositeType(this.parentType)
          ? this._context
              .getSchema()
              .getField(this.parentType, this.node.name.value)?.type
          : undefined) ?? null;
    }
    return this._outputType ?? undefined;
  }

  getArgumentsKey(): string {
    return (this._argumentsKey ??= argumentsKey(
      this.node.arguments,
      this.variableScope,
      this._context,
    ));
  }

  getStreamArgumentsKey(): string | undefined {
    if (this._streamArgumentsKey === undefined) {
      const stream = getStreamDirective(this.node.directives);
      this._streamArgumentsKey =
        stream === undefined
          ? null
          : argumentsKey(stream.arguments, this.variableScope, this._context);
    }
    return this._streamArgumentsKey ?? undefined;
  }
}

function getStreamDirective(
  directives: ReadonlyArray<DirectiveNode> | undefined,
): DirectiveNode | undefined {
  if (directives === undefined) {
    return;
  }
  for (const directive of directives) {
    if (directive.name.value === 'stream') {
      return directive;
    }
  }
}
