import { invariant } from "../../jsutils/invariant.mjs";
import { isPromise, isPromiseLike } from "../../jsutils/isPromise.mjs";
import { memoize1 } from "../../jsutils/memoize1.mjs";
import { memoize2 } from "../../jsutils/memoize2.mjs";
import { addPath, pathToArray } from "../../jsutils/Path.mjs";
import { locatedError } from "../../error/locatedError.mjs";
import { OperationTypeNode } from "../../language/ast.mjs";
import { collectSubfields as _collectSubfields } from "../collectFields.mjs";
import { collectIteratorPromises } from "../collectIteratorPromises.mjs";
import { Executor } from "../Executor.mjs";
import { returnIteratorCatchingErrors } from "../returnIteratorCatchingErrors.mjs";
import { buildExecutionPlan } from "./buildExecutionPlan.mjs";
import { Computation } from "./Computation.mjs";
import { IncrementalPublisher } from "./IncrementalPublisher.mjs";
import { Queue } from "./Queue.mjs";
const buildExecutionPlanFromInitial = memoize1((groupedFieldSet) => buildExecutionPlan(groupedFieldSet));
const buildExecutionPlanFromDeferred = memoize2((groupedFieldSet, deferUsageSet) => buildExecutionPlan(groupedFieldSet, deferUsageSet));
export class IncrementalExecutor extends Executor {
    constructor(validatedExecutionArgs, sharedExecutionContext, deferUsageSet) {
        super(validatedExecutionArgs, sharedExecutionContext);
        this.deferUsageSet = deferUsageSet;
        this.groups = [];
        this.tasks = [];
        this.streams = [];
    }
    getCreateSubExecutor() {
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const sharedExecutionContext = this.sharedExecutionContext;
        return (deferUsageSet) => new IncrementalExecutor(validatedExecutionArgs, sharedExecutionContext, deferUsageSet);
    }
    abort(reason) {
        super.abort(reason);
        for (const task of this.tasks) {
            const aborted = task.computation.abort(reason);
            if (!(!isPromise(aborted)))
                invariant(false);
        }
        for (const stream of this.streams) {
            const aborted = stream.queue.abort(reason);
            if (!(!isPromise(aborted)))
                invariant(false);
        }
    }
    buildResponse(data) {
        const work = this.getIncrementalWork();
        const { tasks, streams } = work;
        if (tasks?.length === 0 && streams?.length === 0) {
            return super.buildResponse(data);
        }
        const errors = this.collectedErrors.errors;
        if (!(data !== null))
            invariant(false);
        const incrementalPublisher = new IncrementalPublisher();
        return incrementalPublisher.buildResponse(data, errors, work, this.validatedExecutionArgs.externalAbortSignal, this.getFinishSharedExecution());
    }
    executeCollectedRootFields(rootType, rootValue, originalGroupedFieldSet, serially, newDeferUsages) {
        if (newDeferUsages.length === 0) {
            return this.executeRootGroupedFieldSet(rootType, rootValue, originalGroupedFieldSet, serially, undefined);
        }
        if (!(this.validatedExecutionArgs.operation.operation !==
            OperationTypeNode.SUBSCRIPTION))
            invariant(false, '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.');
        const { newDeliveryGroups, newDeliveryGroupMap } = this.getNewDeliveryGroupMap(newDeferUsages, undefined, undefined);
        const { groupedFieldSet, newGroupedFieldSets } = this.buildRootExecutionPlan(originalGroupedFieldSet);
        const data = this.executeRootGroupedFieldSet(rootType, rootValue, groupedFieldSet, serially, newDeliveryGroupMap);
        this.groups.push(...newDeliveryGroups);
        if (newGroupedFieldSets.size > 0) {
            this.collectExecutionGroups(rootType, rootValue, undefined, newGroupedFieldSets, newDeliveryGroupMap);
        }
        return data;
    }
    buildRootExecutionPlan(originalGroupedFieldSet) {
        return buildExecutionPlanFromInitial(originalGroupedFieldSet);
    }
    executeCollectedSubfields(parentType, sourceValue, path, originalGroupedFieldSet, newDeferUsages, deliveryGroupMap) {
        if (newDeferUsages.length > 0) {
            if (!(this.validatedExecutionArgs.operation.operation !==
                OperationTypeNode.SUBSCRIPTION))
                invariant(false, '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.');
        }
        if (deliveryGroupMap === undefined && newDeferUsages.length === 0) {
            return this.executeFields(parentType, sourceValue, path, originalGroupedFieldSet, deliveryGroupMap);
        }
        const { newDeliveryGroups, newDeliveryGroupMap } = this.getNewDeliveryGroupMap(newDeferUsages, deliveryGroupMap, path);
        const { groupedFieldSet, newGroupedFieldSets } = this.buildSubExecutionPlan(originalGroupedFieldSet);
        const data = this.executeFields(parentType, sourceValue, path, groupedFieldSet, newDeliveryGroupMap);
        this.groups.push(...newDeliveryGroups);
        if (newGroupedFieldSets.size > 0) {
            this.collectExecutionGroups(parentType, sourceValue, path, newGroupedFieldSets, newDeliveryGroupMap);
        }
        return data;
    }
    buildSubExecutionPlan(originalGroupedFieldSet) {
        return this.deferUsageSet === undefined
            ? buildExecutionPlanFromInitial(originalGroupedFieldSet)
            : buildExecutionPlanFromDeferred(originalGroupedFieldSet, this.deferUsageSet);
    }
    collectExecutionGroups(parentType, sourceValue, path, newGroupedFieldSets, deliveryGroupMap) {
        const createSubExecutor = this.getCreateSubExecutor();
        for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
            const deliveryGroups = getDeliveryGroups(deferUsageSet, deliveryGroupMap);
            const executor = createSubExecutor(deferUsageSet);
            const executionGroup = {
                groups: deliveryGroups,
                path,
                computation: new Computation(() => executor.executeExecutionGroup(deliveryGroups, parentType, sourceValue, path, groupedFieldSet, deliveryGroupMap), (reason) => executor.abort(reason)),
            };
            const parentDeferUsages = this.deferUsageSet;
            if (this.validatedExecutionArgs.enableEarlyExecution) {
                if (this.shouldDefer(parentDeferUsages, deferUsageSet)) {
                    Promise.resolve().then(() => executionGroup.computation.prime());
                }
                else {
                    executionGroup.computation.prime();
                }
            }
            this.tasks.push(executionGroup);
        }
    }
    executeExecutionGroup(deliveryGroups, parentType, sourceValue, path, groupedFieldSet, deliveryGroupMap) {
        let result;
        try {
            result = this.executeFields(parentType, sourceValue, path, groupedFieldSet, deliveryGroupMap);
        }
        catch (error) {
            this.abort();
            throw error;
        }
        if (isPromise(result)) {
            return result.then((resolved) => this.buildExecutionGroupResult(deliveryGroups, path, resolved), (error) => {
                this.abort();
                throw error;
            });
        }
        return this.buildExecutionGroupResult(deliveryGroups, path, result);
    }
    buildExecutionGroupResult(deliveryGroups, path, result) {
        const data = result;
        const errors = this.collectedErrors.errors;
        return this.finish({
            value: errors.length
                ? { deliveryGroups, path: pathToArray(path), errors, data }
                : { deliveryGroups, path: pathToArray(path), data },
            work: this.getIncrementalWork(),
        });
    }
    getIncrementalWork() {
        const { groups, tasks, streams, collectedErrors } = this;
        if (collectedErrors.errors.length === 0) {
            return { groups, tasks, streams };
        }
        const cancellationReason = new Error('Cancelled secondary to null within original result');
        const filteredTasks = [];
        for (const task of tasks) {
            if (collectedErrors.hasNulledPosition(task.path)) {
                const aborted = task.computation.abort(cancellationReason);
                if (!(!isPromise(aborted)))
                    invariant(false);
            }
            else {
                filteredTasks.push(task);
            }
        }
        const filteredStreams = [];
        for (const stream of streams) {
            if (collectedErrors.hasNulledPosition(stream.path)) {
                const aborted = stream.queue.abort(cancellationReason);
                if (!(!isPromise(aborted)))
                    invariant(false);
            }
            else {
                filteredStreams.push(stream);
            }
        }
        return {
            groups,
            tasks: filteredTasks,
            streams: filteredStreams,
        };
    }
    getNewDeliveryGroupMap(newDeferUsages, deliveryGroupMap, path) {
        const newDeliveryGroups = [];
        const newDeliveryGroupMap = new Map(deliveryGroupMap);
        for (const newDeferUsage of newDeferUsages) {
            const parentDeferUsage = newDeferUsage.parentDeferUsage;
            const parent = parentDeferUsage === undefined
                ? undefined
                : deliveryGroupFromDeferUsage(parentDeferUsage, newDeliveryGroupMap);
            const deliveryGroup = {
                path,
                label: newDeferUsage.label,
                parent,
            };
            newDeliveryGroups.push(deliveryGroup);
            newDeliveryGroupMap.set(newDeferUsage, deliveryGroup);
        }
        return {
            newDeliveryGroups,
            newDeliveryGroupMap,
        };
    }
    shouldDefer(parentDeferUsages, deferUsages) {
        return (parentDeferUsages === undefined ||
            !Array.from(deferUsages).every((deferUsage) => parentDeferUsages.has(deferUsage)));
    }
    handleStream(index, path, iterator, streamUsage, info, itemType) {
        const { handle, isAsync } = iterator;
        const queue = this.buildStreamItemQueue(index, path, handle, streamUsage.fieldDetailsList, info, itemType, isAsync);
        const itemStream = {
            label: streamUsage.label,
            path,
            queue,
            initialCount: index,
        };
        this.streams.push(itemStream);
        return true;
    }
    buildStreamItemQueue(initialIndex, streamPath, iterator, fieldDetailsList, info, itemType, isAsync) {
        const createSubExecutor = this.getCreateSubExecutor();
        const { enableEarlyExecution } = this.validatedExecutionArgs;
        const sharedExecutionContext = this.sharedExecutionContext;
        const queue = new Queue(async ({ push, stop, onStop, started }) => {
            const abortStreamItems = new Set();
            let finishedNormally = false;
            let stopRequested = false;
            onStop((reason) => {
                stopRequested = true;
                if (!finishedNormally) {
                    for (const abortStreamItem of abortStreamItems) {
                        abortStreamItem(reason);
                    }
                    if (isAsync) {
                        sharedExecutionContext.asyncWorkTracker.add(returnIteratorCatchingErrors(iterator));
                    }
                    else {
                        sharedExecutionContext.asyncWorkTracker.addValues(collectIteratorPromises(iterator));
                    }
                }
            });
            await (enableEarlyExecution ? Promise.resolve() : started);
            if (stopRequested) {
                return;
            }
            let index = initialIndex;
            while (true) {
                let iteration;
                try {
                    if (isAsync) {
                        iteration = await iterator.next();
                        if (stopRequested) {
                            return;
                        }
                    }
                    else {
                        iteration = iterator.next();
                    }
                }
                catch (rawError) {
                    throw locatedError(rawError, toNodes(fieldDetailsList), pathToArray(streamPath));
                }
                if (iteration.done) {
                    finishedNormally = true;
                    const stopped = stop();
                    if (isPromise(stopped)) {
                        stopped.catch(() => undefined);
                    }
                    return;
                }
                const itemPath = addPath(streamPath, index, undefined);
                const executor = createSubExecutor();
                let streamItemResult = executor.completeStreamItem(itemPath, iteration.value, fieldDetailsList, info, itemType);
                if (isPromise(streamItemResult)) {
                    if (enableEarlyExecution) {
                        const abortStreamItem = (reason) => executor.abort(reason);
                        abortStreamItems.add(abortStreamItem);
                        streamItemResult = streamItemResult.finally(() => {
                            abortStreamItems.delete(abortStreamItem);
                        });
                    }
                    else {
                        streamItemResult = await streamItemResult;
                        if (stopRequested) {
                            return;
                        }
                    }
                }
                const pushResult = push(streamItemResult);
                if (isPromise(pushResult)) {
                    await pushResult;
                    if (stopRequested) {
                        return;
                    }
                }
                index += 1;
            }
        }, 100);
        return queue;
    }
    completeStreamItem(itemPath, item, fieldDetailsList, info, itemType) {
        if (isPromiseLike(item)) {
            return this.completePromisedValue(itemType, fieldDetailsList, info, itemPath, item, undefined)
                .then((resolvedItem) => this.buildStreamItemResult(resolvedItem), (rawError) => {
                this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
                return this.buildStreamItemResult(null);
            })
                .then(undefined, (error) => {
                this.abort();
                throw error;
            });
        }
        let result;
        try {
            try {
                result = this.completeValue(itemType, fieldDetailsList, info, itemPath, item, undefined);
            }
            catch (rawError) {
                this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
                return this.buildStreamItemResult(null);
            }
        }
        catch (error) {
            this.abort();
            throw error;
        }
        if (isPromise(result)) {
            return result
                .then((resolved) => this.buildStreamItemResult(resolved), (rawError) => {
                this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
                return this.buildStreamItemResult(null);
            })
                .then(undefined, (error) => {
                this.abort();
                throw error;
            });
        }
        return this.buildStreamItemResult(result);
    }
    buildStreamItemResult(result) {
        const item = result;
        const errors = this.collectedErrors.errors;
        const work = this.getIncrementalWork();
        return this.finish(errors.length > 0
            ? { value: { item, errors }, work }
            : { value: { item }, work });
    }
}
function toNodes(fieldDetailsList) {
    return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}
function getDeliveryGroups(deferUsageSet, deliveryGroupMap) {
    return Array.from(deferUsageSet).map((deferUsage) => deliveryGroupFromDeferUsage(deferUsage, deliveryGroupMap));
}
function deliveryGroupFromDeferUsage(deferUsage, deliveryGroupMap) {
    return deliveryGroupMap.get(deferUsage);
}
//# sourceMappingURL=IncrementalExecutor.mjs.map