import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLSchema,
} from '../type/index.js';

import type { FieldDetailsList } from './collectFields.js';
import type { ValidatedExecutionArgs } from './execute.js';
import type { VariableValues } from './values.js';

/** @internal */
export class ResolveInfo implements GraphQLResolveInfo {
  private _validatedExecutionArgs: ValidatedExecutionArgs;
  private _fieldDef: GraphQLField<unknown, unknown>;
  private _fieldDetailsList: FieldDetailsList;
  private _parentType: GraphQLObjectType;
  private _path: Path;
  private _abortSignal: AbortSignal | undefined;

  private _fieldName: string | undefined;
  private _fieldNodes: ReadonlyArray<FieldNode> | undefined;
  private _returnType: GraphQLOutputType | undefined;
  private _schema: GraphQLSchema | undefined;
  private _fragments: ObjMap<FragmentDefinitionNode> | undefined;
  private _rootValue: unknown;
  private _rootValueDefined?: boolean;
  private _operation: OperationDefinitionNode | undefined;
  private _variableValues: VariableValues | undefined;

  // eslint-disable-next-line max-params
  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    fieldDef: GraphQLField<unknown, unknown>,
    fieldDetailsList: FieldDetailsList,
    parentType: GraphQLObjectType,
    path: Path,
    abortSignal: AbortSignal | undefined,
  ) {
    this._validatedExecutionArgs = validatedExecutionArgs;
    this._fieldDef = fieldDef;
    this._fieldDetailsList = fieldDetailsList;
    this._parentType = parentType;
    this._path = path;
    this._abortSignal = abortSignal;
  }

  get fieldName(): string {
    this._fieldName ??= this._fieldDef.name;
    return this._fieldName;
  }

  get fieldNodes(): ReadonlyArray<FieldNode> {
    this._fieldNodes ??= this._fieldDetailsList.map(
      (fieldDetails) => fieldDetails.node,
    );
    return this._fieldNodes;
  }

  get returnType(): GraphQLOutputType {
    this._returnType ??= this._fieldDef.type;
    return this._returnType;
  }

  get parentType(): GraphQLObjectType {
    return this._parentType;
  }

  get path(): Path {
    return this._path;
  }

  get schema(): GraphQLSchema {
    this._schema ??= this._validatedExecutionArgs.schema;
    return this._schema;
  }

  get fragments(): ObjMap<FragmentDefinitionNode> {
    this._fragments ??= this._validatedExecutionArgs.fragmentDefinitions;
    return this._fragments;
  }

  get rootValue(): unknown {
    if (!this._rootValueDefined) {
      this._rootValueDefined = true;
      this._rootValue = this._validatedExecutionArgs.rootValue;
    }
    return this._rootValue;
  }

  get operation(): OperationDefinitionNode {
    this._operation ??= this._validatedExecutionArgs.operation;
    return this._operation;
  }

  get variableValues(): VariableValues {
    this._variableValues ??= this._validatedExecutionArgs.variableValues;
    return this._variableValues;
  }

  get abortSignal(): AbortSignal | undefined {
    return this._abortSignal;
  }
}
