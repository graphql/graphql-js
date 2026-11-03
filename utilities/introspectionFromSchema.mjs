import { invariant } from "../jsutils/invariant.mjs";
import { parse } from "../language/parser.mjs";
import { executeSync } from "../execution/execute.mjs";
import { getIntrospectionQuery } from "./getIntrospectionQuery.mjs";
export function introspectionFromSchema(schema, options) {
    const optionsWithDefaults = {
        specifiedByUrl: true,
        directiveIsRepeatable: true,
        schemaDescription: true,
        inputValueDeprecation: true,
        experimentalDirectiveDeprecation: true,
        oneOf: true,
        ...options,
    };
    const document = parse(getIntrospectionQuery(optionsWithDefaults));
    const result = executeSync({ schema, document });
    if (!(result.errors == null && result.data != null))
        invariant(false);
    return result.data;
}
//# sourceMappingURL=introspectionFromSchema.mjs.map