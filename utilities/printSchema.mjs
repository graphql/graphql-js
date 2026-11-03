import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isPrintableAsBlockString } from "../language/blockString.mjs";
import { Kind } from "../language/kinds.mjs";
import { print } from "../language/printer.mjs";
import { isEnumType, isInputObjectType, isInterfaceType, isObjectType, isScalarType, isUnionType, } from "../type/definition.mjs";
import { DEFAULT_DEPRECATION_REASON, isSpecifiedDirective, } from "../type/directives.mjs";
import { isIntrospectionType } from "../type/introspection.mjs";
import { isSpecifiedScalarType } from "../type/scalars.mjs";
import { getDefaultValueAST } from "./getDefaultValueAST.mjs";
export function printSchema(schema) {
    return printFilteredSchema(schema, (n) => !isSpecifiedDirective(n), isDefinedType);
}
export function printIntrospectionSchema(schema) {
    return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType);
}
function isDefinedType(type) {
    return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}
function printFilteredSchema(schema, directiveFilter, typeFilter) {
    const directives = schema.getDirectives().filter(directiveFilter);
    const types = Object.values(schema.getTypeMap()).filter(typeFilter);
    return [
        printSchemaDefinition(schema),
        ...directives.map((directive) => printDirective(directive)),
        ...types.map((type) => printType(type)),
    ]
        .filter(Boolean)
        .join('\n\n');
}
function printSchemaDefinition(schema) {
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();
    if (!queryType && !mutationType && !subscriptionType) {
        return;
    }
    if (schema.description != null || !hasDefaultRootOperationTypes(schema)) {
        return (printDescription(schema) +
            'schema {\n' +
            (queryType ? `  query: ${queryType}\n` : '') +
            (mutationType ? `  mutation: ${mutationType}\n` : '') +
            (subscriptionType ? `  subscription: ${subscriptionType}\n` : '') +
            '}');
    }
}
function hasDefaultRootOperationTypes(schema) {
    return (schema.getQueryType() == schema.getType('Query') &&
        schema.getMutationType() == schema.getType('Mutation') &&
        schema.getSubscriptionType() == schema.getType('Subscription'));
}
export function printType(type) {
    if (isScalarType(type)) {
        return printScalar(type);
    }
    if (isObjectType(type)) {
        return printObject(type);
    }
    if (isInterfaceType(type)) {
        return printInterface(type);
    }
    if (isUnionType(type)) {
        return printUnion(type);
    }
    if (isEnumType(type)) {
        return printEnum(type);
    }
    if (isInputObjectType(type)) {
        return printInputObject(type);
    }
    invariant(false, 'Unexpected type: ' + inspect(type));
}
function printScalar(type) {
    return printDescription(type) + `scalar ${type}` + printSpecifiedByURL(type);
}
function printImplementedInterfaces(type) {
    const interfaces = type.getInterfaces();
    return interfaces.length
        ? ' implements ' + interfaces.map((i) => i.name).join(' & ')
        : '';
}
function printObject(type) {
    return (printDescription(type) +
        `type ${type}` +
        printImplementedInterfaces(type) +
        printFields(type));
}
function printInterface(type) {
    return (printDescription(type) +
        `interface ${type}` +
        printImplementedInterfaces(type) +
        printFields(type));
}
function printUnion(type) {
    const types = type.getTypes();
    const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
    return printDescription(type) + `union ${type.name}` + possibleTypes;
}
function printEnum(type) {
    const values = type
        .getValues()
        .map((value, i) => printDescription(value, '  ', !i) +
        '  ' +
        value.name +
        printDeprecated(value.deprecationReason));
    return printDescription(type) + `enum ${type}` + printBlock(values);
}
function printInputObject(type) {
    const fields = Object.values(type.getFields()).map((f, i) => printDescription(f, '  ', !i) + '  ' + printInputValue(f));
    return (printDescription(type) +
        `input ${type}` +
        (type.isOneOf ? ' @oneOf' : '') +
        printBlock(fields));
}
function printFields(type) {
    const fields = Object.values(type.getFields()).map((f, i) => printDescription(f, '  ', !i) +
        '  ' +
        f.name +
        printArgs(f.args, '  ') +
        ': ' +
        String(f.type) +
        printDeprecated(f.deprecationReason));
    return printBlock(fields);
}
function printBlock(items) {
    return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}
function printArgs(args, indentation = '') {
    if (args.length === 0) {
        return '';
    }
    if (args.every((arg) => arg.description == null)) {
        return '(' + args.map(printInputValue).join(', ') + ')';
    }
    return ('(\n' +
        args
            .map((arg, i) => printDescription(arg, '  ' + indentation, !i) +
            '  ' +
            indentation +
            printInputValue(arg))
            .join('\n') +
        '\n' +
        indentation +
        ')');
}
function printInputValue(argOrInputField) {
    let argDecl = argOrInputField.name + ': ' + String(argOrInputField.type);
    const defaultValueAST = getDefaultValueAST(argOrInputField);
    if (defaultValueAST) {
        argDecl += ` = ${print(defaultValueAST)}`;
    }
    return argDecl + printDeprecated(argOrInputField.deprecationReason);
}
export function printDirective(directive) {
    return (printDescription(directive) +
        `directive ${directive}` +
        printArgs(directive.args) +
        printDeprecated(directive.deprecationReason) +
        (directive.isRepeatable ? ' repeatable' : '') +
        ' on ' +
        directive.locations.join(' | '));
}
function printDeprecated(reason) {
    if (reason == null) {
        return '';
    }
    if (reason !== DEFAULT_DEPRECATION_REASON) {
        const astValue = print({ kind: Kind.STRING, value: reason });
        return ` @deprecated(reason: ${astValue})`;
    }
    return ' @deprecated';
}
function printSpecifiedByURL(scalar) {
    if (scalar.specifiedByURL == null) {
        return '';
    }
    const astValue = print({
        kind: Kind.STRING,
        value: scalar.specifiedByURL,
    });
    return ` @specifiedBy(url: ${astValue})`;
}
function printDescription(def, indentation = '', firstInBlock = true) {
    const { description } = def;
    if (description == null) {
        return '';
    }
    const blockString = print({
        kind: Kind.STRING,
        value: description,
        block: isPrintableAsBlockString(description),
    });
    const prefix = indentation && !firstInBlock ? '\n' + indentation : indentation;
    return prefix + blockString.replaceAll('\n', '\n' + indentation) + '\n';
}
//# sourceMappingURL=printSchema.mjs.map