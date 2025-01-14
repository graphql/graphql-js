"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
exports.assertValidSchema = assertValidSchema;
const AccumulatorMap_js_1 = require("../jsutils/AccumulatorMap.js");
const capitalize_js_1 = require("../jsutils/capitalize.js");
const formatList_js_1 = require("../jsutils/formatList.js");
const inspect_js_1 = require("../jsutils/inspect.js");
const invariant_js_1 = require("../jsutils/invariant.js");
const isIterableObject_js_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const keyMap_js_1 = require("../jsutils/keyMap.js");
const mapValue_js_1 = require("../jsutils/mapValue.js");
const printPathArray_js_1 = require("../jsutils/printPathArray.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const ast_js_1 = require("../language/ast.js");
const kinds_js_1 = require("../language/kinds.js");
const typeComparators_js_1 = require("../utilities/typeComparators.js");
const validateInputValue_js_1 = require("../utilities/validateInputValue.js");
const definition_js_1 = require("./definition.js");
const directives_js_1 = require("./directives.js");
const introspection_js_1 = require("./introspection.js");
const schema_js_1 = require("./schema.js");
/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
function validateSchema(schema) {
    // First check to ensure the provided value is in fact a GraphQLSchema.
    (0, schema_js_1.assertSchema)(schema);
    // If this Schema has already been validated, return the previous results.
    if (schema.__validationErrors) {
        return schema.__validationErrors;
    }
    // Validate the schema, producing a list of errors.
    const context = new SchemaValidationContext(schema);
    validateRootTypes(context);
    validateDirectives(context);
    validateTypes(context);
    // Persist the results of validation before returning to ensure validation
    // does not run multiple times for this schema.
    const errors = context.getErrors();
    schema.__validationErrors = errors;
    return errors;
}
/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 */
function assertValidSchema(schema) {
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
        this._errors.push(new GraphQLError_js_1.GraphQLError(message, { nodes: _nodes }));
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
    const rootTypesMap = new AccumulatorMap_js_1.AccumulatorMap();
    for (const operationType of Object.values(ast_js_1.OperationTypeNode)) {
        const rootType = schema.getRootType(operationType);
        if (rootType != null) {
            if (!(0, definition_js_1.isObjectType)(rootType)) {
                const operationTypeStr = (0, capitalize_js_1.capitalize)(operationType);
                const rootTypeStr = (0, inspect_js_1.inspect)(rootType);
                context.reportError(operationType === ast_js_1.OperationTypeNode.QUERY
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
            const operationList = (0, formatList_js_1.andList)(operationTypes);
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
        // Ensure all directives are in fact GraphQL directives.
        if (!(0, directives_js_1.isDirective)(directive)) {
            context.reportError(`Expected directive but got: ${(0, inspect_js_1.inspect)(directive)}.`, directive?.astNode);
            continue;
        }
        // Ensure they are named correctly.
        validateName(context, directive);
        if (directive.locations.length === 0) {
            context.reportError(`Directive ${directive} must include 1 or more locations.`, directive.astNode);
        }
        // Ensure the arguments are valid.
        for (const arg of directive.args) {
            // Ensure they are named correctly.
            validateName(context, arg);
            // Ensure the type is an input type.
            if (!(0, definition_js_1.isInputType)(arg.type)) {
                context.reportError(`The type of ${arg} must be Input Type ` +
                    `but got: ${(0, inspect_js_1.inspect)(arg.type)}.`, arg.astNode);
            }
            if ((0, definition_js_1.isRequiredArgument)(arg) && arg.deprecationReason != null) {
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
    if (defaultInput.literal) {
        (0, validateInputValue_js_1.validateInputLiteral)(defaultInput.literal, inputValue.type, (error, path) => {
            context.reportError(`${inputValue} has invalid default value${(0, printPathArray_js_1.printPathArray)(path)}: ${error.message}`, error.nodes);
        });
    }
    else {
        const errors = [];
        (0, validateInputValue_js_1.validateInputValue)(defaultInput.value, inputValue.type, (error, path) => {
            errors.push([error, path]);
        });
        // If there were validation errors, check to see if it can be "uncoerced"
        // and then correctly validated. If so, report a clear error with a path
        // to resolution.
        if (errors.length > 0) {
            try {
                const uncoercedValue = uncoerceDefaultValue(defaultInput.value, inputValue.type);
                const uncoercedErrors = [];
                (0, validateInputValue_js_1.validateInputValue)(uncoercedValue, inputValue.type, (error, path) => {
                    uncoercedErrors.push([error, path]);
                });
                if (uncoercedErrors.length === 0) {
                    context.reportError(`${inputValue} has invalid default value: ${(0, inspect_js_1.inspect)(defaultInput.value)}. Did you mean: ${(0, inspect_js_1.inspect)(uncoercedValue)}?`, inputValue.astNode?.defaultValue);
                    return;
                }
            }
            catch (_error) {
                // ignore
            }
        }
        // Otherwise report the original set of errors.
        for (const [error, path] of errors) {
            context.reportError(`${inputValue} has invalid default value${(0, printPathArray_js_1.printPathArray)(path)}: ${error.message}`, inputValue.astNode?.defaultValue);
        }
    }
}
/**
 * Historically GraphQL.js allowed default values to be provided as
 * assumed-coerced "internal" values, however default values should be provided
 * as "external" pre-coerced values. `uncoerceDefaultValue()` will convert such
 * "internal" values to "external" values to display as part of validation.
 *
 * This performs the "opposite" of `coerceInputValue()`. Given an "internal"
 * coerced value, reverse the process to provide an "external" uncoerced value.
 */
function uncoerceDefaultValue(value, type) {
    if ((0, definition_js_1.isNonNullType)(type)) {
        return uncoerceDefaultValue(value, type.ofType);
    }
    if (value === null) {
        return null;
    }
    if ((0, definition_js_1.isListType)(type)) {
        if ((0, isIterableObject_js_1.isIterableObject)(value)) {
            return Array.from(value, (itemValue) => uncoerceDefaultValue(itemValue, type.ofType));
        }
        return [uncoerceDefaultValue(value, type.ofType)];
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        ((0, isObjectLike_js_1.isObjectLike)(value)) || (0, invariant_js_1.invariant)(false);
        const fieldDefs = type.getFields();
        return (0, mapValue_js_1.mapValue)(value, (fieldValue, fieldName) => {
            (fieldName in fieldDefs) || (0, invariant_js_1.invariant)(false);
            return uncoerceDefaultValue(fieldValue, fieldDefs[fieldName].type);
        });
    }
    (0, definition_js_1.assertLeafType)(type);
    // For most leaf types (Scalars, Enums), output value coercion ("serialize") is
    // the inverse of input coercion ("parseValue") and will produce an
    // "external" value. Historically, this method was also used as part of the
    // now-deprecated "astFromValue" to perform the same behavior.
    return type.coerceOutputValue(value);
}
function validateName(context, node) {
    // Ensure names are valid, however introspection types opt out.
    if (node.name.startsWith('__')) {
        context.reportError(`Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`, node.astNode);
    }
}
function validateTypes(context) {
    // Ensure Input Objects do not contain non-nullable circular references.
    const validateInputObjectNonNullCircularRefs = createInputObjectNonNullCircularRefsValidator(context);
    const validateInputObjectDefaultValueCircularRefs = createInputObjectDefaultValueCircularRefsValidator(context);
    const typeMap = context.schema.getTypeMap();
    for (const type of Object.values(typeMap)) {
        // Ensure all provided types are in fact GraphQL type.
        if (!(0, definition_js_1.isNamedType)(type)) {
            context.reportError(`Expected GraphQL named type but got: ${(0, inspect_js_1.inspect)(type)}.`, type.astNode);
            continue;
        }
        // Ensure it is named correctly (excluding introspection types).
        if (!(0, introspection_js_1.isIntrospectionType)(type)) {
            validateName(context, type);
        }
        if ((0, definition_js_1.isObjectType)(type)) {
            // Ensure fields are valid
            validateFields(context, type);
            // Ensure objects implement the interfaces they claim to.
            validateInterfaces(context, type);
        }
        else if ((0, definition_js_1.isInterfaceType)(type)) {
            // Ensure fields are valid.
            validateFields(context, type);
            // Ensure interfaces implement the interfaces they claim to.
            validateInterfaces(context, type);
        }
        else if ((0, definition_js_1.isUnionType)(type)) {
            // Ensure Unions include valid member types.
            validateUnionMembers(context, type);
        }
        else if ((0, definition_js_1.isEnumType)(type)) {
            // Ensure Enums have valid values.
            validateEnumValues(context, type);
        }
        else if ((0, definition_js_1.isInputObjectType)(type)) {
            // Ensure Input Object fields are valid.
            validateInputFields(context, type);
            // Ensure Input Objects do not contain invalid field circular references.
            // Ensure Input Objects do not contain non-nullable circular references.
            validateInputObjectNonNullCircularRefs(type);
            // Ensure Input Objects do not contain invalid default value circular references.
            validateInputObjectDefaultValueCircularRefs(type);
        }
    }
}
function validateFields(context, type) {
    const fields = Object.values(type.getFields());
    // Objects and Interfaces both must define one or more fields.
    if (fields.length === 0) {
        context.reportError(`Type ${type} must define one or more fields.`, [
            type.astNode,
            ...type.extensionASTNodes,
        ]);
    }
    for (const field of fields) {
        // Ensure they are named correctly.
        validateName(context, field);
        // Ensure the type is an output type
        if (!(0, definition_js_1.isOutputType)(field.type)) {
            context.reportError(`The type of ${field} must be Output Type ` +
                `but got: ${(0, inspect_js_1.inspect)(field.type)}.`, field.astNode?.type);
        }
        // Ensure the arguments are valid
        for (const arg of field.args) {
            // Ensure they are named correctly.
            validateName(context, arg);
            // Ensure the type is an input type
            if (!(0, definition_js_1.isInputType)(arg.type)) {
                context.reportError(`The type of ${arg} must be Input Type but got: ${(0, inspect_js_1.inspect)(arg.type)}.`, arg.astNode?.type);
            }
            if ((0, definition_js_1.isRequiredArgument)(arg) && arg.deprecationReason != null) {
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
        if (!(0, definition_js_1.isInterfaceType)(iface)) {
            context.reportError(`Type ${type} must only implement Interface types, ` +
                `it cannot implement ${(0, inspect_js_1.inspect)(iface)}.`, getAllImplementsInterfaceNodes(type, iface));
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
    // Assert each interface field is implemented.
    for (const ifaceField of Object.values(iface.getFields())) {
        const typeField = typeFieldMap[ifaceField.name];
        // Assert interface field exists on type.
        if (typeField == null) {
            context.reportError(`Interface field ${ifaceField} expected but ${type} does not provide it.`, [ifaceField.astNode, type.astNode, ...type.extensionASTNodes]);
            continue;
        }
        // Assert interface field type is satisfied by type field type, by being
        // a valid subtype. (covariant)
        if (!(0, typeComparators_js_1.isTypeSubTypeOf)(context.schema, typeField.type, ifaceField.type)) {
            context.reportError(`Interface field ${ifaceField} expects type ${ifaceField.type} ` +
                `but ${typeField} is type ${typeField.type}.`, [ifaceField.astNode?.type, typeField.astNode?.type]);
        }
        // Assert each interface field arg is implemented.
        for (const ifaceArg of ifaceField.args) {
            const typeArg = typeField.args.find((arg) => arg.name === ifaceArg.name);
            // Assert interface field arg exists on object field.
            if (!typeArg) {
                context.reportError(`Interface field argument ${ifaceArg} expected but ${typeField} does not provide it.`, [ifaceArg.astNode, typeField.astNode]);
                continue;
            }
            // Assert interface field arg type matches object field arg type.
            // (invariant)
            // TODO: change to contravariant?
            if (!(0, typeComparators_js_1.isEqualType)(ifaceArg.type, typeArg.type)) {
                context.reportError(`Interface field argument ${ifaceArg} expects type ${ifaceArg.type} ` +
                    `but ${typeArg} is type ${typeArg.type}.`, [ifaceArg.astNode?.type, typeArg.astNode?.type]);
            }
        }
        // Assert additional arguments must not be required.
        for (const typeArg of typeField.args) {
            if ((0, definition_js_1.isRequiredArgument)(typeArg)) {
                const ifaceArg = ifaceField.args.find((arg) => arg.name === typeArg.name);
                if (!ifaceArg) {
                    context.reportError(`Argument "${typeArg}" must not be required type "${typeArg.type}" ` +
                        `if not provided by the Interface field "${ifaceField}".`, [typeArg.astNode, ifaceField.astNode]);
                }
            }
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
        if (!(0, definition_js_1.isObjectType)(memberType)) {
            context.reportError(`Union type ${union} can only include Object types, ` +
                `it cannot include ${(0, inspect_js_1.inspect)(memberType)}.`, getUnionMemberTypeNodes(union, String(memberType)));
        }
    }
}
function validateEnumValues(context, enumType) {
    const enumValues = enumType.getValues();
    if (enumValues.length === 0) {
        context.reportError(`Enum type ${enumType} must define one or more values.`, [enumType.astNode, ...enumType.extensionASTNodes]);
    }
    for (const enumValue of enumValues) {
        // Ensure valid name.
        validateName(context, enumValue);
    }
}
function validateInputFields(context, inputObj) {
    const fields = Object.values(inputObj.getFields());
    if (fields.length === 0) {
        context.reportError(`Input Object type ${inputObj} must define one or more fields.`, [inputObj.astNode, ...inputObj.extensionASTNodes]);
    }
    // Ensure the input fields are valid
    for (const field of fields) {
        // Ensure they are named correctly.
        validateName(context, field);
        // Ensure the type is an input type
        if (!(0, definition_js_1.isInputType)(field.type)) {
            context.reportError(`The type of ${field} must be Input Type ` +
                `but got: ${(0, inspect_js_1.inspect)(field.type)}.`, field.astNode?.type);
        }
        if ((0, definition_js_1.isRequiredInputField)(field) && field.deprecationReason != null) {
            context.reportError(`Required input field ${field} cannot be deprecated.`, [getDeprecatedDirectiveNode(field.astNode), field.astNode?.type]);
        }
        validateDefaultValue(context, field);
        if (inputObj.isOneOf) {
            validateOneOfInputObjectField(inputObj, field, context);
        }
    }
}
function validateOneOfInputObjectField(type, field, context) {
    if ((0, definition_js_1.isNonNullType)(field.type)) {
        context.reportError(`OneOf input field ${type}.${field.name} must be nullable.`, field.astNode?.type);
    }
    if (field.default !== undefined || field.defaultValue !== undefined) {
        context.reportError(`OneOf input field ${type}.${field.name} cannot have a default value.`, field.astNode);
    }
}
function createInputObjectNonNullCircularRefsValidator(context) {
    // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
    // Tracks already visited types to maintain O(N) and to ensure that cycles
    // are not redundantly reported.
    const visitedTypes = new Set();
    // Array of types nodes used to produce meaningful errors
    const fieldPath = [];
    // Position in the type path
    const fieldPathIndexByTypeName = Object.create(null);
    return detectCycleRecursive;
    // This does a straight-forward DFS to find cycles.
    // It does not terminate when a cycle was found but continues to explore
    // the graph to find all possible cycles.
    function detectCycleRecursive(inputObj) {
        if (visitedTypes.has(inputObj)) {
            return;
        }
        visitedTypes.add(inputObj);
        fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;
        const fields = Object.values(inputObj.getFields());
        for (const field of fields) {
            if ((0, definition_js_1.isNonNullType)(field.type) && (0, definition_js_1.isInputObjectType)(field.type.ofType)) {
                const fieldType = field.type.ofType;
                const cycleIndex = fieldPathIndexByTypeName[fieldType.name];
                fieldPath.push({
                    fieldStr: `${inputObj}.${field.name}`,
                    astNode: field.astNode,
                });
                if (cycleIndex === undefined) {
                    detectCycleRecursive(fieldType);
                }
                else {
                    const cyclePath = fieldPath.slice(cycleIndex);
                    const pathStr = cyclePath
                        .map((fieldObj) => fieldObj.fieldStr)
                        .join(', ');
                    context.reportError(`Invalid circular reference. The Input Object ${fieldType} references itself ${cyclePath.length > 1
                        ? 'via the non-null fields:'
                        : 'in the non-null field'} ${pathStr}.`, cyclePath.map((fieldObj) => fieldObj.astNode));
                }
                fieldPath.pop();
            }
        }
        fieldPathIndexByTypeName[inputObj.name] = undefined;
    }
}
function createInputObjectDefaultValueCircularRefsValidator(context) {
    // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
    // Tracks already visited types to maintain O(N) and to ensure that cycles
    // are not redundantly reported.
    const visitedFields = Object.create(null);
    // Array of keys for fields and default values used to produce meaningful errors.
    const fieldPath = [];
    // Position in the path
    const fieldPathIndex = Object.create(null);
    // This does a straight-forward DFS to find cycles.
    // It does not terminate when a cycle was found but continues to explore
    // the graph to find all possible cycles.
    return function validateInputObjectDefaultValueCircularRefs(inputObj) {
        // Start with an empty object as a way to visit every field in this input
        // object type and apply every default value.
        return detectValueDefaultValueCycle(inputObj, {});
    };
    function detectValueDefaultValueCycle(inputObj, defaultValue) {
        // If the value is a List, recursively check each entry for a cycle.
        // Otherwise, only object values can contain a cycle.
        if ((0, isIterableObject_js_1.isIterableObject)(defaultValue)) {
            for (const itemValue of defaultValue) {
                detectValueDefaultValueCycle(inputObj, itemValue);
            }
            return;
        }
        else if (!(0, isObjectLike_js_1.isObjectLike)(defaultValue)) {
            return;
        }
        // Check each defined field for a cycle.
        for (const field of Object.values(inputObj.getFields())) {
            const namedFieldType = (0, definition_js_1.getNamedType)(field.type);
            // Only input object type fields can result in a cycle.
            if (!(0, definition_js_1.isInputObjectType)(namedFieldType)) {
                continue;
            }
            if (Object.hasOwn(defaultValue, field.name)) {
                // If the provided value has this field defined, recursively check it
                // for cycles.
                detectValueDefaultValueCycle(namedFieldType, defaultValue[field.name]);
            }
            else {
                // Otherwise check this field's default value for cycles.
                detectFieldDefaultValueCycle(field, namedFieldType, `${inputObj}.${field.name}`);
            }
        }
    }
    function detectLiteralDefaultValueCycle(inputObj, defaultValue) {
        // If the value is a List, recursively check each entry for a cycle.
        // Otherwise, only object values can contain a cycle.
        if (defaultValue.kind === kinds_js_1.Kind.LIST) {
            for (const itemLiteral of defaultValue.values) {
                detectLiteralDefaultValueCycle(inputObj, itemLiteral);
            }
            return;
        }
        else if (defaultValue.kind !== kinds_js_1.Kind.OBJECT) {
            return;
        }
        // Check each defined field for a cycle.
        const fieldNodes = (0, keyMap_js_1.keyMap)(defaultValue.fields, (field) => field.name.value);
        for (const field of Object.values(inputObj.getFields())) {
            const namedFieldType = (0, definition_js_1.getNamedType)(field.type);
            // Only input object type fields can result in a cycle.
            if (!(0, definition_js_1.isInputObjectType)(namedFieldType)) {
                continue;
            }
            if (Object.hasOwn(fieldNodes, field.name)) {
                // If the provided value has this field defined, recursively check it
                // for cycles.
                detectLiteralDefaultValueCycle(namedFieldType, fieldNodes[field.name].value);
            }
            else {
                // Otherwise check this field's default value for cycles.
                detectFieldDefaultValueCycle(field, namedFieldType, `${inputObj}.${field.name}`);
            }
        }
    }
    function detectFieldDefaultValueCycle(field, fieldType, fieldStr) {
        // Only a field with a default value can result in a cycle.
        const defaultInput = field.default;
        if (defaultInput === undefined) {
            return;
        }
        // Check to see if there is cycle.
        const cycleIndex = fieldPathIndex[fieldStr];
        if (cycleIndex !== undefined && cycleIndex > 0) {
            context.reportError(`Invalid circular reference. The default value of Input Object field ${fieldStr} references itself${cycleIndex < fieldPath.length
                ? ` via the default values of: ${fieldPath
                    .slice(cycleIndex)
                    .map(([stringForMessage]) => stringForMessage)
                    .join(', ')}`
                : ''}.`, fieldPath.slice(cycleIndex - 1).map(([, node]) => node));
            return;
        }
        // Recurse into this field's default value once, tracking the path.
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
        .flatMap((unionNode) => /* c8 ignore next */ unionNode.types ?? [])
        .filter((typeNode) => typeNode.name.value === typeName);
}
function getDeprecatedDirectiveNode(definitionNode) {
    return definitionNode?.directives?.find((node) => node.name.value === directives_js_1.GraphQLDeprecatedDirective.name);
}
//# sourceMappingURL=validate.js.map