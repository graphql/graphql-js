import { parse } from "./language/parser.mjs";
import { validate } from "./validation/validate.mjs";
import { execute, subscribe } from "./execution/execute.mjs";
export const defaultHarness = {
    parse,
    validate,
    execute,
    subscribe,
};
//# sourceMappingURL=harness.mjs.map