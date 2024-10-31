import type { ObjMap } from '../jsutils/ObjMap.js';
import type { GraphQLError } from '../error/GraphQLError.js';
import type { PromiseCanceller } from './PromiseCanceller.js';
import type { CancellableStreamRecord, ExperimentalIncrementalExecutionResults, IncrementalDataRecord } from './types.js';
export declare function buildIncrementalResponse(context: IncrementalPublisherContext, result: ObjMap<unknown>, errors: ReadonlyArray<GraphQLError> | undefined, incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>): ExperimentalIncrementalExecutionResults;
interface IncrementalPublisherContext {
    promiseCanceller: PromiseCanceller | undefined;
    cancellableStreams: Set<CancellableStreamRecord> | undefined;
}
export {};
