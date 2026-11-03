import { addPath, pathToArray } from "../../jsutils/Path.mjs";
import { ensureGraphQLError } from "../../error/ensureGraphQLError.mjs";
import { createWorkQueue } from "../incremental/WorkQueue.mjs";
import { mapAsyncIterable } from "../mapAsyncIterable.mjs";
import { withConcurrentAbruptClose } from "../withConcurrentAbruptClose.mjs";
export class BranchingIncrementalPublisher {
    constructor() {
        this._indices = new Map();
    }
    buildResponse(data, errors, work, abortSignal, onFinished) {
        const { initialStreams, events } = createWorkQueue(work);
        for (const stream of initialStreams) {
            this._indices.set(stream, stream.initialCount);
        }
        function abort() {
            subsequentResults.throw(abortSignal?.reason).catch(() => {
            });
        }
        if (abortSignal) {
            abortSignal.addEventListener('abort', abort);
        }
        const onWorkQueueFinished = () => {
            onFinished();
            abortSignal?.removeEventListener('abort', abort);
        };
        const initialResult = errors.length
            ? { errors, data, hasNext: true }
            : { data, hasNext: true };
        const subsequentResults = withConcurrentAbruptClose(mapAsyncIterable(events, (batch) => this._handleBatch(batch, onWorkQueueFinished)), () => onWorkQueueFinished());
        return {
            initialResult,
            subsequentResults,
        };
    }
    _handleBatch(batch, onWorkQueueFinished) {
        const context = {
            incremental: [],
            hasNext: true,
        };
        for (const event of batch) {
            this._handleWorkQueueEvent(event, context, onWorkQueueFinished);
        }
        const { incremental, hasNext } = context;
        const result = { hasNext };
        if (incremental.length > 0) {
            result.incremental = incremental;
        }
        return result;
    }
    _handleWorkQueueEvent(event, context, onWorkQueueFinished) {
        switch (event.kind) {
            case 'GROUP_VALUES': {
                const group = event.group;
                for (const value of event.values) {
                    context.incremental.push(buildIncrementalResult({
                        data: value.data,
                        path: pathToArray(group.path),
                    }, group.label, value.errors));
                }
                break;
            }
            case 'GROUP_SUCCESS': {
                break;
            }
            case 'GROUP_FAILURE': {
                const group = event.group;
                context.incremental.push(buildIncrementalResult({
                    data: null,
                    path: pathToArray(group.path),
                }, group.label, [ensureGraphQLError(event.error)]));
                break;
            }
            case 'STREAM_VALUES': {
                const stream = event.stream;
                const { values } = event;
                const items = [];
                const errors = [];
                for (const value of values) {
                    items.push(value.item);
                    if (value.errors !== undefined) {
                        errors.push(...value.errors);
                    }
                }
                let index = this._indices.get(stream);
                if (index === undefined) {
                    index = stream.initialCount;
                    this._indices.set(stream, index);
                }
                this._indices.set(stream, index + items.length);
                context.incremental.push(buildIncrementalResult({
                    items,
                    path: pathToArray(addPath(stream.path, index, undefined)),
                }, stream.label, errors.length > 0 ? errors : undefined));
                break;
            }
            case 'STREAM_SUCCESS': {
                this._indices.delete(event.stream);
                break;
            }
            case 'STREAM_FAILURE': {
                this._indices.delete(event.stream);
                const stream = event.stream;
                context.incremental.push(buildIncrementalResult({
                    items: null,
                    path: pathToArray(stream.path),
                }, stream.label, [ensureGraphQLError(event.error)]));
                break;
            }
            case 'WORK_QUEUE_TERMINATION': {
                onWorkQueueFinished?.();
                context.hasNext = false;
                break;
            }
        }
    }
}
function buildIncrementalResult(originalIncrementalResult, label, errors) {
    const incrementalResult = originalIncrementalResult;
    if (errors !== undefined) {
        incrementalResult.errors = errors;
    }
    if (label !== undefined) {
        incrementalResult.label = label;
    }
    return incrementalResult;
}
//# sourceMappingURL=BranchingIncrementalPublisher.mjs.map