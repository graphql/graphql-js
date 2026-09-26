import { AccumulatorMap } from '../../jsutils/AccumulatorMap.ts';
import { memoize3 } from '../../jsutils/memoize3.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';

import type {
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLType,
} from '../../type/definition.ts';
import { isAbstractType } from '../../type/definition.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import { typeFromAST } from '../../utilities/typeFromAST.ts';

import type {
  DeferUsage,
  FieldDetails,
  FieldDetailsList,
  FragmentDetails,
  FragmentVariableValues,
  RootFieldCollection,
  SubfieldCollection,
} from '../collectFields.ts';
import type { FieldCollectors } from '../ExecutionArgs.ts';
import type { VariableValues } from '../values.ts';
import { getFragmentVariableValues } from '../values.ts';

import type { CompiledArgumentValues } from './compileArgumentValues.ts';
import { compileArgumentValues } from './compileArgumentValues.ts';
import type { DeferDirectiveCompilation } from './compileDeferDirective.ts';
import { compileDeferDirective } from './compileDeferDirective.ts';
import type {
  CompiledFieldExecutionPlan,
  CompiledFieldResolver,
} from './compileFieldExecutionPlan.ts';
import {
  compileFieldExecutionPlan,
  compileFieldResolver,
} from './compileFieldExecutionPlan.ts';
import type {
  CompiledFragmentVariables,
  FragmentVariables,
} from './compileFragmentVariables.ts';
import { compileFragmentVariables } from './compileFragmentVariables.ts';
import type { InclusionDirectiveCompilation } from './compileInclusionDirectives.ts';
import {
  compileIncludeDirective,
  compileSkipDirective,
  shouldIncludeSelection,
} from './compileInclusionDirectives.ts';
import type { CompiledStreamDirective } from './compileStreamDirective.ts';
import {
  compileStreamDirective,
  withStreamDirectiveVariableValues,
} from './compileStreamDirective.ts';
import { getCompiledDeferUsage } from './getCompiledDeferUsage.ts';
import { getStaticFragmentVariableValues } from './getStaticFragmentVariableValues.ts';

/* eslint-disable max-params */

interface CompiledSelectionSet {
  selections: ReadonlyArray<CompiledSelection>;
}

type CompiledSelection =
  | CompiledField
  | CompiledInlineFragment
  | CompiledFragmentSpread;

interface CompiledField extends InclusionDirectiveCompilation {
  kind: Kind.FIELD;
  node: FieldNode;
  fieldName: string;
  responseName: string;
  selectionSet: CompiledSelectionSet | undefined;
  compilationsByFieldDef: WeakMap<
    GraphQLField<unknown, unknown>,
    FieldDefinitionCompilation
  >;
  compiledStreamDirective: CompiledStreamDirective;
}

interface FieldDefinitionCompilation {
  argumentValues: CompiledArgumentValues;
  resolver: CompiledFieldResolver;
  fieldPlan: CompiledFieldExecutionPlan | undefined;
  fieldDetails: FieldDetails | undefined;
  fieldPlanByArgumentValues: WeakMap<
    CompiledArgumentValues,
    Map<CompiledStreamDirective, CompiledFieldExecutionPlan>
  >;
}

interface CompiledInlineFragment
  extends InclusionDirectiveCompilation, DeferDirectiveCompilation {
  kind: Kind.INLINE_FRAGMENT;
  condition: CompiledFragmentCondition;
  selectionSet: CompiledSelectionSet;
}

interface CompiledFragmentSpread
  extends InclusionDirectiveCompilation, DeferDirectiveCompilation {
  kind: Kind.FRAGMENT_SPREAD;
  node: FragmentSpreadNode;
  fragmentName: string;
  compiledFragmentVariables: CompiledFragmentVariables | undefined;
}

interface CompiledFragment {
  details: FragmentDetails;
  condition: CompiledFragmentCondition;
  selectionSet: CompiledSelectionSet;
}

type CompiledFragmentCondition = GraphQLType | null | undefined;

interface CollectFieldsContext {
  schema: GraphQLSchema;
  fragments: ObjMap<CompiledFragment>;
  variableValues: VariableValues;
  runtimeType: GraphQLObjectType;
  visitedFragmentNames: Map<string, boolean>;
  hideSuggestions: boolean;
  usesDefaultFieldResolver: boolean;
}

const SKIP_DIRECTIVE_NAME = 'skip';
const INCLUDE_DIRECTIVE_NAME = 'include';
const DEFER_DIRECTIVE_NAME = 'defer';
const STREAM_DIRECTIVE_NAME = 'stream';

/** @internal */
export function compileCollectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  rootSelectionSet: SelectionSetNode,
  hideSuggestions: boolean,
  usesDefaultFieldResolver: boolean,
): FieldCollectors {
  const compiledSelectionSetByFieldNode = new WeakMap<
    FieldNode,
    CompiledSelectionSet
  >();
  const compiledRootSelectionSet = compileSelectionSet(rootSelectionSet);
  const compiledFragments: ObjMap<CompiledFragment> = Object.create(null);
  for (const [fragmentName, details] of Object.entries(fragments)) {
    compiledFragments[fragmentName] = {
      details,
      condition: compileFragmentCondition(details.definition),
      selectionSet: compileSelectionSet(details.definition.selectionSet),
    };
  }

  const collectRootFields = (
    variableValues: VariableValues,
    rootType: GraphQLObjectType,
  ): RootFieldCollection => {
    const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
    const newDeferUsages: Array<DeferUsage> = [];

    collectFieldsImpl(
      createContext(variableValues, rootType),
      compiledRootSelectionSet,
      groupedFieldSet,
      newDeferUsages,
    );

    return {
      groupedFieldSet,
      newDeferUsages,
      forbiddenDirectiveInstances: [],
    };
  };

  const collectSubfields = memoize3(
    (
      variableValues: VariableValues,
      returnType: GraphQLObjectType,
      fieldDetailsList: FieldDetailsList,
    ): SubfieldCollection => {
      const context = createContext(variableValues, returnType);
      const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();
      const newDeferUsages: Array<DeferUsage> = [];

      for (const fieldDetail of fieldDetailsList) {
        const selectionSet = getCompiledFieldSelectionSet(fieldDetail);
        if (selectionSet) {
          const {
            deferUsage,
            fragmentVariableValues,
            staticFragmentVariableValues,
          } = fieldDetail;
          collectFieldsImpl(
            context,
            selectionSet,
            subGroupedFieldSet,
            newDeferUsages,
            deferUsage,
            fragmentVariableValues,
            staticFragmentVariableValues,
          );
        }
      }

      return {
        groupedFieldSet: subGroupedFieldSet,
        newDeferUsages,
      };
    },
  );

  return { collectRootFields, collectSubfields };

  function getCompiledFieldSelectionSet(
    fieldDetail: FieldDetails,
  ): CompiledSelectionSet | undefined {
    const selectionSet = fieldDetail.node.selectionSet;
    return selectionSet === undefined
      ? undefined
      : (compiledSelectionSetByFieldNode.get(fieldDetail.node) ??
          compileSelectionSet(selectionSet));
  }

  function createContext(
    variableValues: VariableValues,
    runtimeType: GraphQLObjectType,
  ): CollectFieldsContext {
    return {
      schema,
      fragments: compiledFragments,
      variableValues,
      runtimeType,
      visitedFragmentNames: new Map(),
      hideSuggestions,
      usesDefaultFieldResolver,
    };
  }

  function compileSelectionSet(
    selectionSet: SelectionSetNode,
  ): CompiledSelectionSet {
    return {
      selections: selectionSet.selections.map(compileSelection),
    };
  }

  function compileSelection(
    selection: SelectionSetNode['selections'][number],
  ): CompiledSelection {
    switch (selection.kind) {
      case Kind.FIELD: {
        const directives = getFieldDirectiveNodes(selection);
        const selectionSet =
          selection.selectionSet === undefined
            ? undefined
            : compileSelectionSet(selection.selectionSet);
        if (selectionSet !== undefined) {
          compiledSelectionSetByFieldNode.set(selection, selectionSet);
        }
        return {
          kind: Kind.FIELD,
          node: selection,
          fieldName: selection.name.value,
          responseName: selection.alias
            ? selection.alias.value
            : selection.name.value,
          selectionSet,
          compilationsByFieldDef: new WeakMap(),
          compiledStreamDirective: compileStreamDirective(
            directives.streamDirectiveNode,
          ),
          skipDirective: compileSkipDirective(directives.skipDirectiveNode),
          includeDirective: compileIncludeDirective(
            directives.includeDirectiveNode,
          ),
        };
      }
      case Kind.INLINE_FRAGMENT: {
        const directives = getFragmentDirectiveNodes(selection);
        return {
          kind: Kind.INLINE_FRAGMENT,
          condition: compileFragmentCondition(selection),
          selectionSet: compileSelectionSet(selection.selectionSet),
          skipDirective: compileSkipDirective(directives.skipDirectiveNode),
          includeDirective: compileIncludeDirective(
            directives.includeDirectiveNode,
          ),
          deferDirective: compileDeferDirective(directives.deferDirectiveNode),
        };
      }
      case Kind.FRAGMENT_SPREAD: {
        const directives = getFragmentDirectiveNodes(selection);
        return {
          kind: Kind.FRAGMENT_SPREAD,
          node: selection,
          fragmentName: selection.name.value,
          compiledFragmentVariables: getCompiledFragmentVariables(selection),
          skipDirective: compileSkipDirective(directives.skipDirectiveNode),
          includeDirective: compileIncludeDirective(
            directives.includeDirectiveNode,
          ),
          deferDirective: compileDeferDirective(directives.deferDirectiveNode),
        };
      }
    }
  }

  function getCompiledFragmentVariables(
    fragmentSpreadNode: FragmentSpreadNode,
  ): CompiledFragmentVariables | undefined {
    const fragmentVariableSignatures =
      fragments[fragmentSpreadNode.name.value]?.variableSignatures;
    return fragmentVariableSignatures === undefined
      ? undefined
      : compileFragmentVariables(
          fragmentSpreadNode,
          fragmentVariableSignatures,
        );
  }

  function compileFragmentCondition(
    fragment: FragmentDefinitionNode | InlineFragmentNode,
  ): CompiledFragmentCondition {
    return fragment.typeCondition === undefined
      ? null
      : typeFromAST(schema, fragment.typeCondition);
  }
}

function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: CompiledSelectionSet,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  newDeferUsages: Array<DeferUsage>,
  deferUsage?: DeferUsage,
  fragmentVariableValues?: FragmentVariableValues,
  staticFragmentVariableValues?: FragmentVariableValues,
): void {
  const fragmentVariables = getFragmentVariables(
    fragmentVariableValues,
    staticFragmentVariableValues,
  );

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(context, selection, fragmentVariables)) {
          continue;
        }
        const fieldDef = context.schema.getField(
          context.runtimeType,
          selection.fieldName,
        );
        const fieldDetails =
          fieldDef === undefined
            ? {
                node: selection.node,
                deferUsage,
                fragmentVariableValues,
                staticFragmentVariableValues,
                compiledFieldPlan: undefined,
              }
            : deferUsage === undefined &&
                fragmentVariableValues === undefined &&
                staticFragmentVariableValues === undefined
              ? getOrCompileFieldDetails(selection, fieldDef, context)
              : {
                  node: selection.node,
                  deferUsage,
                  fragmentVariableValues,
                  staticFragmentVariableValues,
                  compiledFieldPlan: getOrCompileFieldExecutionPlan(
                    selection,
                    fieldDef,
                    context,
                    fragmentVariableValues,
                    staticFragmentVariableValues,
                  ),
                };
        groupedFieldSet.add(selection.responseName, fieldDetails);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(context, selection, fragmentVariables) ||
          !doesFragmentConditionMatch(context, selection.condition)
        ) {
          continue;
        }

        const newDeferUsage = getDeferUsage(
          context,
          selection,
          deferUsage,
          fragmentVariables,
        );

        if (newDeferUsage) {
          newDeferUsages.push(newDeferUsage);
        }
        collectFieldsImpl(
          context,
          selection.selectionSet,
          groupedFieldSet,
          newDeferUsages,
          newDeferUsage ?? deferUsage,
          fragmentVariableValues,
          staticFragmentVariableValues,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD:
        collectFragmentSpread(
          context,
          selection,
          groupedFieldSet,
          newDeferUsages,
          deferUsage,
          fragmentVariableValues,
          staticFragmentVariableValues,
          fragmentVariables,
        );
    }
  }
}

function getFragmentVariables(
  runtime: FragmentVariableValues | undefined,
  staticValues: FragmentVariableValues | undefined,
): FragmentVariables | undefined {
  return runtime === undefined && staticValues === undefined
    ? undefined
    : { runtime, static: staticValues };
}

function getOrCompileFieldDetails(
  selection: CompiledField,
  fieldDef: GraphQLField<unknown, unknown>,
  context: CollectFieldsContext,
): FieldDetails {
  const compilation = getOrCompileFieldDefinition(selection, fieldDef, context);
  let fieldDetails = compilation.fieldDetails;
  if (fieldDetails === undefined) {
    fieldDetails = {
      node: selection.node,
      deferUsage: undefined,
      fragmentVariableValues: undefined,
      staticFragmentVariableValues: undefined,
      compiledFieldPlan: getOrCompileFieldExecutionPlanForDefinition(
        selection,
        compilation,
        undefined,
        undefined,
      ),
    };
    compilation.fieldDetails = fieldDetails;
  }
  return fieldDetails;
}

function getOrCompileFieldExecutionPlan(
  selection: CompiledField,
  fieldDef: GraphQLField<unknown, unknown>,
  context: CollectFieldsContext,
  fragmentVariableValues: FragmentVariableValues | undefined,
  staticFragmentVariableValues: FragmentVariableValues | undefined,
): CompiledFieldExecutionPlan {
  const compilation = getOrCompileFieldDefinition(selection, fieldDef, context);
  return getOrCompileFieldExecutionPlanForDefinition(
    selection,
    compilation,
    fragmentVariableValues,
    staticFragmentVariableValues,
  );
}

function getOrCompileFieldExecutionPlanForDefinition(
  selection: CompiledField,
  compilation: FieldDefinitionCompilation,
  fragmentVariableValues: FragmentVariableValues | undefined,
  staticFragmentVariableValues: FragmentVariableValues | undefined,
): CompiledFieldExecutionPlan {
  if (
    fragmentVariableValues === undefined &&
    staticFragmentVariableValues === undefined
  ) {
    let compiledFieldPlan = compilation.fieldPlan;
    if (compiledFieldPlan === undefined) {
      compiledFieldPlan = compileFieldExecutionPlan(
        compilation.resolver,
        getCompiledArgsWithFragmentValues(compilation, undefined),
        selection.compiledStreamDirective,
      );
      compilation.fieldPlan = compiledFieldPlan;
    }
    return compiledFieldPlan;
  }

  const compiledArgumentValues = getCompiledArgsWithFragmentValues(
    compilation,
    fragmentVariableValues,
  );
  const compiledStreamDirective = withStreamDirectiveVariableValues(
    selection.compiledStreamDirective,
    fragmentVariableValues,
    staticFragmentVariableValues,
  );

  let compiledFieldPlanByStreamDirective =
    compilation.fieldPlanByArgumentValues.get(compiledArgumentValues);
  if (compiledFieldPlanByStreamDirective === undefined) {
    compiledFieldPlanByStreamDirective = new Map();
    compilation.fieldPlanByArgumentValues.set(
      compiledArgumentValues,
      compiledFieldPlanByStreamDirective,
    );
  }

  let compiledFieldPlan = compiledFieldPlanByStreamDirective.get(
    compiledStreamDirective,
  );
  if (compiledFieldPlan === undefined) {
    compiledFieldPlan = compileFieldExecutionPlan(
      compilation.resolver,
      compiledArgumentValues,
      compiledStreamDirective,
    );
    compiledFieldPlanByStreamDirective.set(
      compiledStreamDirective,
      compiledFieldPlan,
    );
  }
  return compiledFieldPlan;
}

function getOrCompileFieldDefinition(
  selection: CompiledField,
  fieldDef: GraphQLField<unknown, unknown>,
  context: CollectFieldsContext,
): FieldDefinitionCompilation {
  let compilation = selection.compilationsByFieldDef.get(fieldDef);
  if (compilation === undefined) {
    compilation = {
      argumentValues: compileArgumentValues(
        fieldDef,
        selection.node,
        context.hideSuggestions,
        undefined,
      ),
      resolver: compileFieldResolver(
        fieldDef,
        context.usesDefaultFieldResolver,
      ),
      fieldPlan: undefined,
      fieldDetails: undefined,
      fieldPlanByArgumentValues: new WeakMap(),
    };
    selection.compilationsByFieldDef.set(fieldDef, compilation);
  }
  return compilation;
}

function getCompiledArgsWithFragmentValues(
  compilation: FieldDefinitionCompilation,
  fragmentVariableValues: FragmentVariableValues | undefined,
): CompiledArgumentValues {
  const compiledArgumentValues = compilation.argumentValues;
  return fragmentVariableValues === undefined ||
    compiledArgumentValues.constantValues !== undefined
    ? compiledArgumentValues
    : { ...compiledArgumentValues, fragmentVariableValues };
}

function collectFragmentSpread(
  context: CollectFieldsContext,
  selection: CompiledFragmentSpread,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  newDeferUsages: Array<DeferUsage>,
  deferUsage: DeferUsage | undefined,
  fragmentVariableValues: FragmentVariableValues | undefined,
  staticFragmentVariableValues: FragmentVariableValues | undefined,
  fragmentVariables: FragmentVariables | undefined,
): void {
  if (!shouldIncludeNode(context, selection, fragmentVariables)) {
    return;
  }

  const fragment = context.fragments[selection.fragmentName];
  if (
    fragment === undefined ||
    !doesFragmentConditionMatch(context, fragment.condition)
  ) {
    return;
  }

  const newDeferUsage = getDeferUsage(
    context,
    selection,
    deferUsage,
    fragmentVariables,
  );
  const visitedAsDeferred = context.visitedFragmentNames.get(
    selection.fragmentName,
  );

  let maybeNewDeferUsage: DeferUsage | undefined;
  if (!newDeferUsage) {
    if (visitedAsDeferred === false) {
      return;
    }
    context.visitedFragmentNames.set(selection.fragmentName, false);
    maybeNewDeferUsage = deferUsage;
  } else {
    if (visitedAsDeferred !== undefined) {
      return;
    }
    context.visitedFragmentNames.set(selection.fragmentName, true);
    newDeferUsages.push(newDeferUsage);
    maybeNewDeferUsage = newDeferUsage;
  }

  const fragmentVariableSignatures = fragment.details.variableSignatures;
  let newFragmentVariableValues: FragmentVariableValues | undefined;
  let newStaticFragmentVariableValues: FragmentVariableValues | undefined;
  if (fragmentVariableSignatures) {
    newFragmentVariableValues = getFragmentVariableValues(
      selection.node,
      fragmentVariableSignatures,
      context.variableValues,
      fragmentVariableValues,
      context.hideSuggestions,
    );
    newStaticFragmentVariableValues = getStaticFragmentVariableValues(
      selection.compiledFragmentVariables,
      staticFragmentVariableValues,
    );
  }

  collectFieldsImpl(
    context,
    fragment.selectionSet,
    groupedFieldSet,
    newDeferUsages,
    maybeNewDeferUsage,
    newFragmentVariableValues,
    newStaticFragmentVariableValues,
  );
}

function shouldIncludeNode(
  context: CollectFieldsContext,
  selection: InclusionDirectiveCompilation,
  fragmentVariables: FragmentVariables | undefined,
): boolean {
  return shouldIncludeSelection(
    selection,
    context.variableValues,
    fragmentVariables,
    context.hideSuggestions,
  );
}

function getDeferUsage(
  context: CollectFieldsContext,
  selection: DeferDirectiveCompilation,
  parentDeferUsage: DeferUsage | undefined,
  fragmentVariables: FragmentVariables | undefined,
): DeferUsage | undefined {
  return getCompiledDeferUsage(
    selection,
    parentDeferUsage,
    context.variableValues,
    fragmentVariables,
    context.hideSuggestions,
  );
}

function doesFragmentConditionMatch(
  context: CollectFieldsContext,
  conditionalType: CompiledFragmentCondition,
): boolean {
  if (conditionalType === null) {
    return true;
  }
  if (conditionalType === undefined) {
    return false;
  }
  if (conditionalType === context.runtimeType) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return context.schema.isSubType(conditionalType, context.runtimeType);
  }
  return false;
}

interface FieldDirectiveNodes {
  skipDirectiveNode: DirectiveNode | undefined;
  includeDirectiveNode: DirectiveNode | undefined;
  streamDirectiveNode: DirectiveNode | undefined;
}

interface FragmentDirectiveNodes {
  skipDirectiveNode: DirectiveNode | undefined;
  includeDirectiveNode: DirectiveNode | undefined;
  deferDirectiveNode: DirectiveNode | undefined;
}

function getFieldDirectiveNodes(node: FieldNode): FieldDirectiveNodes {
  let skipDirectiveNode;
  let includeDirectiveNode;
  let streamDirectiveNode;

  for (const directiveNode of node.directives ?? []) {
    switch (directiveNode.name.value) {
      case SKIP_DIRECTIVE_NAME:
        skipDirectiveNode = directiveNode;
        break;
      case INCLUDE_DIRECTIVE_NAME:
        includeDirectiveNode = directiveNode;
        break;
      case STREAM_DIRECTIVE_NAME:
        streamDirectiveNode = directiveNode;
        break;
    }
  }

  return { skipDirectiveNode, includeDirectiveNode, streamDirectiveNode };
}

function getFragmentDirectiveNodes(
  node: FragmentSpreadNode | InlineFragmentNode,
): FragmentDirectiveNodes {
  let skipDirectiveNode;
  let includeDirectiveNode;
  let deferDirectiveNode;

  for (const directiveNode of node.directives ?? []) {
    switch (directiveNode.name.value) {
      case SKIP_DIRECTIVE_NAME:
        skipDirectiveNode = directiveNode;
        break;
      case INCLUDE_DIRECTIVE_NAME:
        includeDirectiveNode = directiveNode;
        break;
      case DEFER_DIRECTIVE_NAME:
        deferDirectiveNode = directiveNode;
        break;
    }
  }

  return { skipDirectiveNode, includeDirectiveNode, deferDirectiveNode };
}
