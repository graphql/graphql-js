import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

interface ExecutionDetails {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [key: string]: unknown };
}

/** @internal */
/** @internal */
export class ResolveInfo implements GraphQLResolveInfo {
  private _executionDetails: ExecutionDetails;
  private _fieldDef: GraphQLField<unknown, unknown>;
  private _fieldNodes: ReadonlyArray<FieldNode>;
  private _parentType: GraphQLObjectType;
  private _path: Path;

  private _fieldName: string | undefined;
  private _returnType: GraphQLOutputType | undefined;
  private _schema: GraphQLSchema | undefined;
  private _fragments: ObjMap<FragmentDefinitionNode> | undefined;
  private _rootValue: unknown;
  private _rootValueDefined?: boolean;
  private _operation: OperationDefinitionNode | undefined;
  private _variableValues: { [key: string]: unknown } | undefined;

  constructor(
    executionDetails: ExecutionDetails,
    fieldDef: GraphQLField<unknown, unknown>,
    fieldNodes: ReadonlyArray<FieldNode>,
    parentType: GraphQLObjectType,
    path: Path,
  ) {
    this._executionDetails = executionDetails;
    this._fieldDef = fieldDef;
    this._fieldNodes = fieldNodes;
    this._parentType = parentType;
    this._path = path;
  }

  get fieldName(): string {
    this._fieldName ??= this._fieldDef.name;
    return this._fieldName;
  }

  get fieldNodes(): ReadonlyArray<FieldNode> {
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
    this._schema ??= this._executionDetails.schema;
    return this._schema;
  }

  get fragments(): ObjMap<FragmentDefinitionNode> {
    this._fragments ??= this._executionDetails.fragments;
    return this._fragments;
  }

  get rootValue(): unknown {
    if (!this._rootValueDefined) {
      this._rootValueDefined = true;
      this._rootValue = this._executionDetails.rootValue;
    }
    return this._rootValue;
  }

  get operation(): OperationDefinitionNode {
    this._operation ??= this._executionDetails.operation;
    return this._operation;
  }

  get variableValues(): { [key: string]: unknown } {
    this._variableValues ??= this._executionDetails.variableValues;
    return this._variableValues;
  }
}
