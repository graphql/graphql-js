import type { ObjMap } from "../../jsutils/ObjMap.mjs";
import type { GraphQLError } from "../../error/GraphQLError.mjs";
import type { ExperimentalIncrementalExecutionResults, IncrementalWork } from "./IncrementalExecutor.mjs";
/** @internal */
export declare class IncrementalPublisher {
    private _ids;
    private _nextId;
    private _cachedPathToArray;
    constructor();
    buildResponse(data: ObjMap<unknown>, errors: ReadonlyArray<GraphQLError>, work: IncrementalWork, abortSignal: AbortSignal | undefined, onFinished: () => void): ExperimentalIncrementalExecutionResults;
    private _pathToArray;
    private _ensureId;
    private _toPendingResults;
    private _handleBatch;
    private _handleWorkQueueEvent;
    private _getBestIdAndSubPath;
}
