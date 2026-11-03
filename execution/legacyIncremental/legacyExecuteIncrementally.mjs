import { validateExecutionArgs } from "../execute.mjs";
import { BranchingIncrementalExecutor } from "./BranchingIncrementalExecutor.mjs";
export function legacyExecuteIncrementally(args) {
    const validatedExecutionArgs = validateExecutionArgs(args);
    if (!('schema' in validatedExecutionArgs)) {
        return { errors: validatedExecutionArgs };
    }
    return legacyExecuteRootSelectionSet(validatedExecutionArgs);
}
export function legacyExecuteRootSelectionSet(validatedExecutionArgs) {
    return new BranchingIncrementalExecutor(validatedExecutionArgs).executeRootSelectionSet();
}
//# sourceMappingURL=legacyExecuteIncrementally.mjs.map