import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
import { capitalize } from "../jsutils/capitalize.mjs";
import { andList } from "../jsutils/formatList.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isIterableObject } from "../jsutils/isIterableObject.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { keyMap } from "../jsutils/keyMap.mjs";
import { mapValue } from "../jsutils/mapValue.mjs";
import { printPathArray } from "../jsutils/printPathArray.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { Kind } from "../language/kinds.mjs";
import { isEqualType, isTypeSubTypeOf } from "../utilities/typeComparators.mjs";
import { validateInputLiteral, validateInputValue, } from "../utilities/validateInputValue.mjs";
import { assertLeafType, getNamedType, isEnumType, isInputObjectType, isInputType, isInterfaceType, isListType, isNamedType, isNonNullType, isObjectType, isOutputType, isRequiredArgument, isRequiredInputField, isUnionType, } from "./definition.mjs";
import { GraphQLDeprecatedDirective, isDirective } from "./directives.mjs";
import { isIntrospectionType } from "./introspection.mjs";
import { assertSchema } from "./schema.mjs";
export function validateSchema(schema) {
    assertSchema(schema);
    if (schema.__validationErrors) {
        return schema.__validationErrors;
    }
    const context = new SchemaValidationContext(schema);
    validateRootTypes(context);
    validateDirectives(context);
    validateTypes(context);
    const errors = context.getErrors();
    schema.__validationErrors = errors;
    return errors;
}
export function assertValidSchema(schema) {
    const errors = validateSchema(schema);
    if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
}
class SchemaValidationContext {
    constructor(schema) {
        this._errors = [];
        this.schema = schema;
    }
    reportError(message, nodes) {
        const _nodes = Array.isArray(nodes)
            ? nodes.filter(Boolean)
            : nodes;
        this._errors.push(new GraphQLError(message, { nodes: _nodes }));
    }
    getErrors() {
        return this._errors;
    }
}
function validateRootTypes(context) {
    const schema = context.schema;
    if (schema.getQueryType() == null) {
        context.reportError('Query root type must be provided.', schema.astNode);
    }
    const rootTypesMap = new AccumulatorMap();
    for (const operationType of Object.values(OperationTypeNode)) {
        const rootType = schema.getRootType(operationType);
        if (rootType != null) {
            if (!isObjectType(rootType)) {
                const operationTypeStr = capitalize(operationType);
                const rootTypeStr = inspect(rootType);
                context.reportError(operationType === OperationTypeNode.QUERY
                    ? `${operationTypeStr} root type must be Object type, it cannot be ${rootTypeStr}.`
                    : `${operationTypeStr} root type must be Object type if provided, it cannot be ${rootTypeStr}.`, getOperationTypeNode(schema, operationType) ??
                    rootType.astNode);
            }
            else {
                rootTypesMap.add(rootType, operationType);
            }
        }
    }
    for (const [rootType, operationTypes] of rootTypesMap) {
        if (operationTypes.length > 1) {
            const operationList = andList(operationTypes);
            context.reportError(`All root types must be different, "${rootType}" type is used as ${operationList} root types.`, operationTypes.map((operationType) => getOperationTypeNode(schema, operationType)));
        }
    }
}
function getOperationTypeNode(schema, operation) {
    return [schema.astNode, ...schema.extensionASTNodes]
        .flatMap((schemaNode) => schemaNode?.operationTypes ?? [])
        .find((operationNode) => operationNode.operation === operation)?.type;
}
function validateDirectives(context) {
    for (const directive of context.schema.getDirectives()) {
        if (!isDirective(directive)) {
            context.reportError(`Expected directive but got: ${inspect(directive)}.`, directive?.astNode);
            continue;
        }
        validateName(context, directive);
        if (directive.locations.length === 0) {
            context.reportError(`Directive ${directive} must include 1 or more locations.`, directive.astNode);
        }
        for (const arg of directive.args) {
            validateName(context, arg);
            if (!isInputType(arg.type)) {
                context.reportError(`The type of ${arg} must be Input Type ` +
                    `but got: ${inspect(arg.type)}.`, arg.astNode);
            }
            if (isRequiredArgument(arg) && arg.deprecationReason != null) {
                context.reportError(`Required argument ${arg} cannot be deprecated.`, [
                    getDeprecatedDirectiveNode(arg.astNode),
                    arg.astNode?.type,
                ]);
            }
            validateDefaultValue(context, arg);
        }
    }
}
function validateDefaultValue(context, inputValue) {
    const defaultInput = inputValue.default;
    if (!defaultInput) {
        return;
    }
    const errors = [];
    validateDefaultInput(defaultInput, inputValue.type, (error, path) => {
        errors.push([error, path]);
    });
    if (errors.length === 0) {
        return;
    }
    if (!defaultInput.literal) {
        try {
            const uncoercedValue = uncoerceDefaultValue(defaultInput.value, inputValue.type);
            const uncoercedErrors = [];
            validateInputValue(uncoercedValue, inputValue.type, (error, path) => {
                uncoercedErrors.push([error, path]);
            });
            if (uncoercedErrors.length === 0) {
                context.reportError(`${inputValue} has invalid default value: ${inspect(defaultInput.value)}. Did you mean: ${inspect(uncoercedValue)}?`, inputValue.astNode?.defaultValue);
                return;
            }
        }
        catch (_error) {
        }
    }
    for (const [error, path] of errors) {
        context.reportError(`${inputValue} has invalid default value${printPathArray(path)}: ${error.message}`, error.nodes ?? inputValue.astNode?.defaultValue);
    }
}
export function validateDefaultInput(defaultInput, inputType, onError, hideSuggestions) {
    if (defaultInput.literal) {
        validateInputLiteral(defaultInput.literal, inputType, onError, undefined, undefined, hideSuggestions);
        return;
    }
    validateInputValue(defaultInput.value, inputType, onError, hideSuggestions);
}
function uncoerceDefaultValue(value, type) {
    if (isNonNullType(type)) {
        return uncoerceDefaultValue(value, type.ofType);
    }
    if (value === null) {
        return null;
    }
    if (isListType(type)) {
        if (isIterableObject(value)) {
            return Array.from(value, (itemValue) => uncoerceDefaultValue(itemValue, type.ofType));
        }
        return [uncoerceDefaultValue(value, type.ofType)];
    }
    if (isInputObjectType(type)) {
        if (!(isObjectLike(value)))
            invariant(false);
        const fieldDefs = type.getFields();
        return mapValue(value, (fieldValue, fieldName) => {
            if (!(fieldName in fieldDefs))
                invariant(false);
            return uncoerceDefaultValue(fieldValue, fieldDefs[fieldName].type);
        });
    }
    assertLeafType(type);
    return type.coerceOutputValue(value);
}
function validateName(context, node) {
    if (node.name.startsWith('__')) {
        context.reportError(`Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`, node.astNode);
    }
}
function validateTypes(context) {
    const validateInputObjectDefaultValueCircularRefs = createInputObjectDefaultValueCircularRefsValidator(context);
    const typeMap = context.schema.getTypeMap();
    const finiteValueStates = new Map();
    for (const type of Object.values(typeMap)) {
        if (!isNamedType(type)) {
            context.reportError(`Expected GraphQL named type but got: ${inspect(type)}.`, type.astNode);
            continue;
        }
        if (!isIntrospectionType(type)) {
            validateName(context, type);
        }
        if (isObjectType(type)) {
            validateFields(context, type);
            validateInterfaces(context, type);
        }
        else if (isInterfaceType(type)) {
            validateFields(context, type);
            validateInterfaces(context, type);
        }
        else if (isUnionType(type)) {
            validateUnionMembers(context, type);
        }
        else if (isEnumType(type)) {
            validateEnumValues(context, type);
        }
        else if (isInputObjectType(type)) {
            validateInputFields(context, type);
            initializeInputObjectFiniteValueState(type);
            validateInputObjectDefaultValueCircularRefs(type);
        }
    }
    detectInputObjectNonFiniteValues(context, finiteValueStates);
    function initializeInputObjectFiniteValueState(inputObj) {
        finiteValueStates.set(inputObj, {
            inputObj,
            targets: [],
            dependents: [],
            unresolvedTargetCount: 0,
            hasFiniteValue: false,
        });
    }
}
function validateFields(context, type) {
    const fields = Object.values(type.getFields());
    if (fields.length === 0) {
        context.reportError(`Type ${type} must define one or more fields.`, [
            type.astNode,
            ...type.extensionASTNodes,
        ]);
    }
    for (const field of fields) {
        validateName(context, field);
        if (!isOutputType(field.type)) {
            context.reportError(`The type of ${field} must be Output Type ` +
                `but got: ${inspect(field.type)}.`, field.astNode?.type);
        }
        for (const arg of field.args) {
            validateName(context, arg);
            if (!isInputType(arg.type)) {
                context.reportError(`The type of ${arg} must be Input Type but got: ${inspect(arg.type)}.`, arg.astNode?.type);
            }
            if (isRequiredArgument(arg) && arg.deprecationReason != null) {
                context.reportError(`Required argument ${arg} cannot be deprecated.`, [
                    getDeprecatedDirectiveNode(arg.astNode),
                    arg.astNode?.type,
                ]);
            }
            validateDefaultValue(context, arg);
        }
    }
}
function validateInterfaces(context, type) {
    const ifaceTypeNames = new Set();
    for (const iface of type.getInterfaces()) {
        if (!isInterfaceType(iface)) {
            context.reportError(`Type ${type} must only implement Interface types, ` +
                `it cannot implement ${inspect(iface)}.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        if (type === iface) {
            context.reportError(`Type ${type} cannot implement itself because it would create a circular reference.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        if (ifaceTypeNames.has(iface.name)) {
            context.reportError(`Type ${type} can only implement ${iface} once.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        ifaceTypeNames.add(iface.name);
        validateTypeImplementsAncestors(context, type, iface);
        validateTypeImplementsInterface(context, type, iface);
    }
}
function validateTypeImplementsInterface(context, type, iface) {
    const typeFieldMap = type.getFields();
    for (const ifaceField of Object.values(iface.getFields())) {
        const typeField = typeFieldMap[ifaceField.name];
        if (typeField == null) {
            context.reportError(`Interface field ${ifaceField} expected but ${type} does not provide it.`, [ifaceField.astNode, type.astNode, ...type.extensionASTNodes]);
            continue;
        }
        if (!isTypeSubTypeOf(context.schema, typeField.type, ifaceField.type)) {
            context.reportError(`Interface field ${ifaceField} expects type ${ifaceField.type} ` +
                `but ${typeField} is type ${typeField.type}.`, [ifaceField.astNode?.type, typeField.astNode?.type]);
        }
        for (const ifaceArg of ifaceField.args) {
            const typeArg = typeField.args.find((arg) => arg.name === ifaceArg.name);
            if (!typeArg) {
                context.reportError(`Interface field argument ${ifaceArg} expected but ${typeField} does not provide it.`, [ifaceArg.astNode, typeField.astNode]);
                continue;
            }
            if (!isEqualType(ifaceArg.type, typeArg.type)) {
                context.reportError(`Interface field argument ${ifaceArg} expects type ${ifaceArg.type} ` +
                    `but ${typeArg} is type ${typeArg.type}.`, [ifaceArg.astNode?.type, typeArg.astNode?.type]);
            }
        }
        for (const typeArg of typeField.args) {
            if (isRequiredArgument(typeArg)) {
                const ifaceArg = ifaceField.args.find((arg) => arg.name === typeArg.name);
                if (!ifaceArg) {
                    context.reportError(`Argument "${typeArg}" must not be required type "${typeArg.type}" ` +
                        `if not provided by the Interface field "${ifaceField}".`, [typeArg.astNode, ifaceField.astNode]);
                }
            }
        }
        if (typeField.deprecationReason != null &&
            ifaceField.deprecationReason == null) {
            context.reportError(`Interface field ${iface.name}.${ifaceField.name} is not deprecated, so ` +
                `implementation field ${type.name}.${typeField.name} must not be deprecated.`, [
                getDeprecatedDirectiveNode(typeField.astNode),
                typeField.astNode?.type,
            ]);
        }
    }
}
function validateTypeImplementsAncestors(context, type, iface) {
    const ifaceInterfaces = type.getInterfaces();
    for (const transitive of iface.getInterfaces()) {
        if (!ifaceInterfaces.includes(transitive)) {
            context.reportError(transitive === type
                ? `Type ${type} cannot implement ${iface} because it would create a circular reference.`
                : `Type ${type} must implement ${transitive} because it is implemented by ${iface}.`, [
                ...getAllImplementsInterfaceNodes(iface, transitive),
                ...getAllImplementsInterfaceNodes(type, iface),
            ]);
        }
    }
}
function validateUnionMembers(context, union) {
    const memberTypes = union.getTypes();
    if (memberTypes.length === 0) {
        context.reportError(`Union type ${union} must define one or more member types.`, [union.astNode, ...union.extensionASTNodes]);
    }
    const includedTypeNames = new Set();
    for (const memberType of memberTypes) {
        if (includedTypeNames.has(memberType.name)) {
            context.reportError(`Union type ${union} can only include type ${memberType} once.`, getUnionMemberTypeNodes(union, memberType.name));
            continue;
        }
        includedTypeNames.add(memberType.name);
        if (!isObjectType(memberType)) {
            context.reportError(`Union type ${union} can only include Object types, ` +
                `it cannot include ${inspect(memberType)}.`, getUnionMemberTypeNodes(union, String(memberType)));
        }
    }
}
function validateEnumValues(context, enumType) {
    const enumValues = enumType.getValues();
    if (enumValues.length === 0) {
        context.reportError(`Enum type ${enumType} must define one or more values.`, [enumType.astNode, ...enumType.extensionASTNodes]);
    }
    for (const enumValue of enumValues) {
        validateName(context, enumValue);
    }
}
function validateInputFields(context, inputObj) {
    const fields = Object.values(inputObj.getFields());
    if (fields.length === 0) {
        context.reportError(`Input Object type ${inputObj} must define one or more fields.`, [inputObj.astNode, ...inputObj.extensionASTNodes]);
    }
    for (const field of fields) {
        validateName(context, field);
        if (!isInputType(field.type)) {
            context.reportError(`The type of ${field} must be Input Type ` +
                `but got: ${inspect(field.type)}.`, field.astNode?.type);
        }
        if (isRequiredInputField(field) && field.deprecationReason != null) {
            context.reportError(`Required input field ${field} cannot be deprecated.`, [getDeprecatedDirectiveNode(field.astNode), field.astNode?.type]);
        }
        validateDefaultValue(context, field);
        if (inputObj.isOneOf) {
            validateOneOfInputObjectField(inputObj, field, context);
        }
    }
}
function validateOneOfInputObjectField(type, field, context) {
    if (isNonNullType(field.type)) {
        context.reportError(`OneOf input field ${type}.${field.name} must be nullable.`, field.astNode?.type);
    }
    if (field.default !== undefined || field.defaultValue !== undefined) {
        context.reportError(`OneOf input field ${type}.${field.name} cannot have a default value.`, field.astNode);
    }
}
function detectInputObjectNonFiniteValues(context, finiteValueStates) {
    const inputObjectsWithFiniteValues = [];
    for (const state of finiteValueStates.values()) {
        const inputObj = state.inputObj;
        const fields = Object.values(inputObj.getFields());
        for (const field of fields) {
            const target = getFiniteValueTarget(inputObj, field.type);
            if (target === undefined) {
                continue;
            }
            state.targets.push({ field, target });
            const targetState = finiteValueStates.get(target);
            if (targetState !== undefined) {
                targetState.dependents.push(state);
            }
        }
        if (inputObj.isOneOf) {
            if (fields.length === 0 || state.targets.length < fields.length) {
                markInputObjectHasFiniteValue(state);
            }
        }
        else {
            state.unresolvedTargetCount = state.targets.length;
            if (state.targets.length === 0) {
                markInputObjectHasFiniteValue(state);
            }
        }
    }
    let nextFiniteValueState;
    while ((nextFiniteValueState = inputObjectsWithFiniteValues.pop()) !== undefined) {
        for (const dependentState of nextFiniteValueState.dependents) {
            if (dependentState.hasFiniteValue) {
                continue;
            }
            if (dependentState.inputObj.isOneOf) {
                markInputObjectHasFiniteValue(dependentState);
                continue;
            }
            --dependentState.unresolvedTargetCount;
            if (dependentState.unresolvedTargetCount === 0) {
                markInputObjectHasFiniteValue(dependentState);
            }
        }
    }
    const visitedTypes = new Set();
    const fieldPath = [];
    const fieldPathIndexByType = new Map();
    for (const state of finiteValueStates.values()) {
        if (!state.hasFiniteValue) {
            reportCycleRecursive(state);
        }
    }
    function markInputObjectHasFiniteValue(finiteValueState) {
        if (!finiteValueState.hasFiniteValue) {
            finiteValueState.hasFiniteValue = true;
            inputObjectsWithFiniteValues.push(finiteValueState);
        }
    }
    function reportCycleRecursive(state) {
        const inputObj = state.inputObj;
        if (visitedTypes.has(inputObj)) {
            return;
        }
        visitedTypes.add(inputObj);
        fieldPathIndexByType.set(inputObj, fieldPath.length);
        for (const { field, target } of state.targets) {
            const targetState = finiteValueStates.get(target);
            if (targetState?.hasFiniteValue !== false) {
                continue;
            }
            const cycleIndex = fieldPathIndexByType.get(target);
            fieldPath.push({
                fieldStr: `${inputObj}.${field.name}`,
                astNode: field.astNode,
            });
            if (cycleIndex === undefined) {
                reportCycleRecursive(targetState);
            }
            else {
                const cyclePath = fieldPath.slice(cycleIndex);
                const pathStr = cyclePath.map((p) => p.fieldStr).join(', ');
                context.reportError(`Input Object ${target} cannot be provided a finite value because it references itself through fields: ${pathStr}.`, cyclePath.map((p) => p.astNode));
            }
            fieldPath.pop();
        }
        fieldPathIndexByType.delete(inputObj);
    }
}
function getFiniteValueTarget(inputObj, fieldType) {
    if (inputObj.isOneOf) {
        if (isInputObjectType(fieldType)) {
            return fieldType;
        }
        return;
    }
    if (isNonNullType(fieldType) && isInputObjectType(fieldType.ofType)) {
        return fieldType.ofType;
    }
}
function createInputObjectDefaultValueCircularRefsValidator(context) {
    const visitedFields = Object.create(null);
    const fieldPath = [];
    const fieldPathIndex = Object.create(null);
    return function validateInputObjectDefaultValueCircularRefs(inputObj) {
        return detectValueDefaultValueCycle(inputObj, Object.create(null));
    };
    function detectValueDefaultValueCycle(inputObj, defaultValue) {
        if (isIterableObject(defaultValue)) {
            for (const itemValue of defaultValue) {
                detectValueDefaultValueCycle(inputObj, itemValue);
            }
            return;
        }
        else if (!isObjectLike(defaultValue)) {
            return;
        }
        for (const field of Object.values(inputObj.getFields())) {
            const namedFieldType = getNamedType(field.type);
            if (!isInputObjectType(namedFieldType)) {
                continue;
            }
            if (Object.hasOwn(defaultValue, field.name)) {
                detectValueDefaultValueCycle(namedFieldType, defaultValue[field.name]);
            }
            else {
                detectFieldDefaultValueCycle(field, namedFieldType, `${inputObj}.${field.name}`);
            }
        }
    }
    function detectLiteralDefaultValueCycle(inputObj, defaultValue) {
        if (defaultValue.kind === Kind.LIST) {
            for (const itemLiteral of defaultValue.values) {
                detectLiteralDefaultValueCycle(inputObj, itemLiteral);
            }
            return;
        }
        else if (defaultValue.kind !== Kind.OBJECT) {
            return;
        }
        const fieldNodes = keyMap(defaultValue.fields, (field) => field.name.value);
        for (const field of Object.values(inputObj.getFields())) {
            const namedFieldType = getNamedType(field.type);
            if (!isInputObjectType(namedFieldType)) {
                continue;
            }
            if (Object.hasOwn(fieldNodes, field.name)) {
                detectLiteralDefaultValueCycle(namedFieldType, fieldNodes[field.name].value);
            }
            else {
                detectFieldDefaultValueCycle(field, namedFieldType, `${inputObj}.${field.name}`);
            }
        }
    }
    function detectFieldDefaultValueCycle(field, fieldType, fieldStr) {
        const defaultInput = field.default;
        if (defaultInput === undefined) {
            return;
        }
        const cycleIndex = fieldPathIndex[fieldStr];
        if (cycleIndex !== undefined) {
            context.reportError(`Invalid circular reference. The default value of Input Object field ${fieldStr} references itself${cycleIndex < fieldPath.length
                ? ` via the default values of: ${fieldPath
                    .slice(cycleIndex)
                    .map(([stringForMessage]) => stringForMessage)
                    .join(', ')}`
                : ''}.`, fieldPath.slice(cycleIndex - 1).map(([, node]) => node));
            return;
        }
        if (visitedFields[fieldStr] === undefined) {
            visitedFields[fieldStr] = true;
            fieldPathIndex[fieldStr] = fieldPath.push([
                fieldStr,
                field.astNode?.defaultValue,
            ]);
            if (defaultInput.literal) {
                detectLiteralDefaultValueCycle(fieldType, defaultInput.literal);
            }
            else {
                detectValueDefaultValueCycle(fieldType, defaultInput.value);
            }
            fieldPath.pop();
            fieldPathIndex[fieldStr] = undefined;
        }
    }
}
function getAllImplementsInterfaceNodes(type, iface) {
    const { astNode, extensionASTNodes } = type;
    const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
    return nodes
        .flatMap((typeNode) => typeNode.interfaces ?? [])
        .filter((ifaceNode) => ifaceNode.name.value === iface.name);
}
function getUnionMemberTypeNodes(union, typeName) {
    const { astNode, extensionASTNodes } = union;
    const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
    return nodes
        .flatMap((unionNode) => unionNode.types ?? [])
        .filter((typeNode) => typeNode.name.value === typeName);
}
function getDeprecatedDirectiveNode(definitionNode) {
    return definitionNode?.directives?.find((node) => node.name.value === GraphQLDeprecatedDirective.name);
}
//# sourceMappingURL=validate.mjs.map