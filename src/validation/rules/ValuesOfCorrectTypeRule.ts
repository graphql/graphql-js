import { didYouMean } from '../../jsutils/didYouMean';
import { inspect } from '../../jsutils/inspect';
import { keyMap } from '../../jsutils/keyMap';
import type { ObjMap } from '../../jsutils/ObjMap';
import { suggestionList } from '../../jsutils/suggestionList';

import { GraphQLError } from '../../error/GraphQLError';

import type {
  DirectiveDefinitionNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  ObjectFieldNode,
  ObjectValueNode,
  TypeNode,
  ValueNode,
} from '../../language/ast';
import type { DirectiveLocation } from '../../language/directiveLocation';
import { Kind } from '../../language/kinds';
import { print } from '../../language/printer';
import type { ASTVisitor } from '../../language/visitor';
import { visit } from '../../language/visitor';

import type {
  GraphQLFieldConfigArgumentMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputType,
} from '../../type/definition';
import {
  getNamedType,
  getNullableType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isLeafType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../../type/definition';
import { GraphQLDirective, specifiedDirectives } from '../../type/directives';
import { specifiedScalarTypes } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { TypeInfo, visitWithTypeInfo } from '../../utilities/TypeInfo';

import type { SDLValidationContext } from '../ValidationContext';
import { ValidationContext } from '../ValidationContext';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 */
export function ValuesOfCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    ListValue(node) {
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      const type = getNullableType(context.getParentInputType());
      if (!isListType(type)) {
        isValidValueNode(context, node);
        return false; // Don't traverse further.
      }
    },
    ObjectValue(node) {
      const type = getNamedType(context.getInputType());
      if (!isInputObjectType(type)) {
        isValidValueNode(context, node);
        return false; // Don't traverse further.
      }
      // Ensure every required field exists.
      const fieldNodeMap = keyMap(node.fields, (field) => field.name.value);
      for (const fieldDef of Object.values(type.getFields())) {
        const fieldNode = fieldNodeMap[fieldDef.name];
        if (!fieldNode && isRequiredInputField(fieldDef)) {
          const typeStr = inspect(fieldDef.type);
          context.reportError(
            new GraphQLError(
              `Field "${type.name}.${fieldDef.name}" of required type "${typeStr}" was not provided.`,
              { nodes: node },
            ),
          );
        }
      }

      if (type.isOneOf) {
        validateOneOfInputObject(context, node, type, fieldNodeMap);
      }
    },
    ObjectField(node) {
      const parentType = getNamedType(context.getParentInputType());
      const fieldType = context.getInputType();
      if (!fieldType && isInputObjectType(parentType)) {
        const suggestions = suggestionList(
          node.name.value,
          Object.keys(parentType.getFields()),
        );
        context.reportError(
          new GraphQLError(
            `Field "${node.name.value}" is not defined by type "${parentType.name}".` +
              didYouMean(suggestions),
            { nodes: node },
          ),
        );
      }
    },
    NullValue(node) {
      const type = context.getInputType();
      if (isNonNullType(type)) {
        context.reportError(
          new GraphQLError(
            `Expected value of type "${inspect(type)}", found ${print(node)}.`,
            { nodes: node },
          ),
        );
      }
    },
    EnumValue: (node) => isValidValueNode(context, node),
    IntValue: (node) => isValidValueNode(context, node),
    FloatValue: (node) => isValidValueNode(context, node),
    // Descriptions are string values that would not validate according
    // to the below logic, but since (per the specification) descriptions must
    // not affect validation, they are ignored entirely when visiting the AST
    // and do not require special handling.
    // See https://spec.graphql.org/draft/#sec-Descriptions
    StringValue: (node) => isValidValueNode(context, node),
    BooleanValue: (node) => isValidValueNode(context, node),
  };
}

/**
 * @internal
 */
export function ValuesOfCorrectTypeOnDirectivesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = getDirectiveSchema(context);

  return {
    Directive(directiveNode) {
      const typeInfo = new TypeInfo(schema);
      const validationContext = new ValidationContext(
        schema,
        context.getDocument(),
        typeInfo,
        (error) => context.reportError(error),
      );

      visit(
        directiveNode,
        // eslint-disable-next-line new-cap
        visitWithTypeInfo(typeInfo, ValuesOfCorrectTypeRule(validationContext)),
      );
      return false;
    },
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidValueNode(context: ValidationContext, node: ValueNode): void {
  // Report any error at the full type expected by the location.
  const locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  const type = getNamedType(locationType);

  if (!isLeafType(type)) {
    const typeStr = inspect(locationType);
    context.reportError(
      new GraphQLError(
        `Expected value of type "${typeStr}", found ${print(node)}.`,
        { nodes: node },
      ),
    );
    return;
  }

  // Scalars and Enums determine if a literal value is valid via parseLiteral(),
  // which may throw or return an invalid value to indicate failure.
  try {
    const parseResult = type.parseLiteral(node, undefined /* variables */);
    if (parseResult === undefined) {
      const typeStr = inspect(locationType);
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}.`,
          { nodes: node },
        ),
      );
    }
  } catch (error) {
    const typeStr = inspect(locationType);
    if (error instanceof GraphQLError) {
      context.reportError(error);
    } else {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}; ` +
            error.message,
          { nodes: node, originalError: error },
        ),
      );
    }
  }
}

function getDirectiveSchema(context: SDLValidationContext): GraphQLSchema {
  const typeMap = getInputTypeMap(context);
  const directiveMap: ObjMap<GraphQLDirective> = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveMap[directive.name] = replaceDirective(directive, typeMap);
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveMap[def.name.value] = buildDirective(def, typeMap);
    }
  }

  return new GraphQLSchema({
    directives: Object.values(directiveMap),
  });
}

function replaceDirective(
  directive: GraphQLDirective,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLDirective {
  const config = directive.toConfig();
  return new GraphQLDirective({
    ...config,
    args: replaceArgumentMap(config.args, typeMap),
  });
}

function buildDirective(
  directive: DirectiveDefinitionNode,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLDirective {
  return new GraphQLDirective({
    name: directive.name.value,
    locations: directive.locations.map(
      (location) => location.value as DirectiveLocation,
    ),
    args: buildArgumentMap(directive.arguments, typeMap),
    isRepeatable: directive.repeatable,
    astNode: directive,
  });
}

function replaceArgumentMap(
  args: GraphQLFieldConfigArgumentMap,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLFieldConfigArgumentMap {
  const argMap: GraphQLFieldConfigArgumentMap = Object.create(null);
  for (const [argName, arg] of Object.entries(args)) {
    argMap[argName] = {
      ...arg,
      type: replaceInputType(arg.type, typeMap),
    };
  }
  return argMap;
}

function buildArgumentMap(
  args: DirectiveDefinitionNode['arguments'],
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLFieldConfigArgumentMap {
  const argMap: GraphQLFieldConfigArgumentMap = Object.create(null);
  const argNodes = args ?? [];
  for (const argNode of argNodes) {
    const type = typeFromASTNode(argNode.type, typeMap);
    if (type) {
      argMap[argNode.name.value] = {
        type,
        defaultValue: argNode.defaultValue === undefined ? undefined : null,
        astNode: argNode,
      };
    }
  }
  return argMap;
}

function getInputTypeMap(
  context: SDLValidationContext,
): ObjMap<GraphQLInputType> {
  const typeMap: ObjMap<GraphQLInputType> = Object.create(null);
  const schema = context.getSchema();

  const enumExtensions: ObjMap<Array<EnumTypeExtensionNode>> =
    Object.create(null);
  const inputObjectExtensions: ObjMap<Array<InputObjectTypeExtensionNode>> =
    Object.create(null);

  for (const def of context.getDocument().definitions) {
    if (def.kind === Kind.ENUM_TYPE_EXTENSION) {
      const extensions = enumExtensions[def.name.value] ?? [];
      extensions.push(def);
      enumExtensions[def.name.value] = extensions;
    } else if (def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
      const extensions = inputObjectExtensions[def.name.value] ?? [];
      extensions.push(def);
      inputObjectExtensions[def.name.value] = extensions;
    }
  }

  if (schema) {
    for (const type of Object.values(schema.getTypeMap())) {
      const enumExtensionsForType = enumExtensions[type.name];
      const inputObjectExtensionsForType = inputObjectExtensions[type.name];
      if (isEnumType(type) && enumExtensionsForType) {
        typeMap[type.name] = extendEnumType(type, enumExtensionsForType);
      } else if (isInputObjectType(type) && inputObjectExtensionsForType) {
        typeMap[type.name] = extendInputObjectType(
          type,
          inputObjectExtensionsForType,
          typeMap,
        );
      } else if (isInputType(type)) {
        typeMap[type.name] = type;
      }
    }
  } else {
    for (const type of specifiedScalarTypes) {
      typeMap[type.name] = type;
    }
  }

  for (const def of context.getDocument().definitions) {
    if (def.kind === Kind.SCALAR_TYPE_DEFINITION) {
      typeMap[def.name.value] = new GraphQLScalarType({
        name: def.name.value,
        astNode: def,
      });
    } else if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
      const enumNodes = [def, ...(enumExtensions[def.name.value] ?? [])];
      typeMap[def.name.value] = buildEnumType(def, enumNodes);
    } else if (def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      const inputNodes = [
        def,
        ...(inputObjectExtensions[def.name.value] ?? []),
      ];
      typeMap[def.name.value] = buildInputObjectType(def, inputNodes, typeMap);
    }
  }

  return typeMap;
}

function replaceInputType<T extends GraphQLInputType>(
  type: T,
  typeMap: ObjMap<GraphQLInputType>,
): T {
  if (isListType(type)) {
    return new GraphQLList(replaceInputType(type.ofType, typeMap)) as T;
  }

  if (isNonNullType(type)) {
    return new GraphQLNonNull(replaceInputType(type.ofType, typeMap)) as T;
  }

  return (typeMap[type.name] ?? type) as T;
}

function extendEnumType(
  type: GraphQLEnumType,
  extensions: ReadonlyArray<EnumTypeExtensionNode>,
): GraphQLEnumType {
  const config = type.toConfig();
  return new GraphQLEnumType({
    ...config,
    values: {
      ...config.values,
      ...buildEnumValueMap(extensions),
    },
    extensionASTNodes: config.extensionASTNodes.concat(extensions),
  });
}

function buildEnumType(
  def: EnumTypeDefinitionNode,
  nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
): GraphQLEnumType {
  return new GraphQLEnumType({
    name: def.name.value,
    values: buildEnumValueMap(nodes),
    astNode: def,
  });
}

function buildEnumValueMap(
  nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>,
) {
  const values = Object.create(null);
  for (const node of nodes) {
    const valueNodes = node.values ?? [];
    for (const valueNode of valueNodes) {
      values[valueNode.name.value] = {};
    }
  }
  return values;
}

function extendInputObjectType(
  type: GraphQLInputObjectType,
  extensions: ReadonlyArray<InputObjectTypeExtensionNode>,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLInputObjectType {
  const config = type.toConfig();
  return new GraphQLInputObjectType({
    ...config,
    fields: () => ({
      ...replaceInputFieldMap(config.fields, typeMap),
      ...buildInputFieldMap(extensions, typeMap),
    }),
    extensionASTNodes: config.extensionASTNodes.concat(extensions),
  });
}

function buildInputObjectType(
  def: InputObjectTypeDefinitionNode,
  nodes: ReadonlyArray<
    InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode
  >,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: def.name.value,
    fields: () => buildInputFieldMap(nodes, typeMap),
    astNode: def,
    isOneOf: Boolean(
      def.directives?.some((directive) => directive.name.value === 'oneOf'),
    ),
  });
}

function replaceInputFieldMap(
  fields: GraphQLInputFieldConfigMap,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLInputFieldConfigMap {
  const fieldMap: GraphQLInputFieldConfigMap = Object.create(null);
  for (const [fieldName, field] of Object.entries(fields)) {
    fieldMap[fieldName] = {
      ...field,
      type: replaceInputType(field.type, typeMap),
    };
  }
  return fieldMap;
}

function buildInputFieldMap(
  nodes: ReadonlyArray<
    InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode
  >,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLInputFieldConfigMap {
  const fields: GraphQLInputFieldConfigMap = Object.create(null);
  for (const node of nodes) {
    const fieldNodes = node.fields ?? [];
    for (const fieldNode of fieldNodes) {
      const type = typeFromASTNode(fieldNode.type, typeMap);
      if (type) {
        fields[fieldNode.name.value] = {
          type,
          defaultValue: fieldNode.defaultValue === undefined ? undefined : null,
          astNode: fieldNode,
        };
      }
    }
  }
  return fields;
}

function typeFromASTNode(
  typeNode: TypeNode,
  typeMap: ObjMap<GraphQLInputType>,
): GraphQLInputType | undefined {
  if (typeNode.kind === Kind.LIST_TYPE) {
    const innerType = typeFromASTNode(typeNode.type, typeMap);
    return innerType && new GraphQLList(innerType);
  }

  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    const innerType = typeFromASTNode(typeNode.type, typeMap);
    if (!innerType || isNonNullType(innerType)) {
      return;
    }
    return new GraphQLNonNull(innerType);
  }

  return typeMap[typeNode.name.value];
}

function validateOneOfInputObject(
  context: ValidationContext | SDLValidationContext,
  node: ObjectValueNode,
  type: GraphQLInputObjectType,
  fieldNodeMap: ObjMap<ObjectFieldNode>,
): void {
  const keys = Object.keys(fieldNodeMap);
  const isNotExactlyOneField = keys.length !== 1;

  if (isNotExactlyOneField) {
    context.reportError(
      new GraphQLError(
        `OneOf Input Object "${type.name}" must specify exactly one key.`,
        { nodes: [node] },
      ),
    );
    return;
  }

  const value = fieldNodeMap[keys[0]]?.value;
  const isNullLiteral = !value || value.kind === Kind.NULL;

  if (isNullLiteral) {
    context.reportError(
      new GraphQLError(`Field "${type.name}.${keys[0]}" must be non-null.`, {
        nodes: [node],
      }),
    );
  }
}
