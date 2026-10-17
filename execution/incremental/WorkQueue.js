"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkQueue = createWorkQueue;
const invariant_ts_1 = require("../../jsutils/invariant.js");
const isPromise_ts_1 = require("../../jsutils/isPromise.js");
const Queue_ts_1 = require("./Queue.js");
function createWorkQueue(initialWork) {
    const rootGroups = new Set();
    const rootStreams = new Set();
    const groupNodes = new Map();
    const taskNodes = new Map();
    let pushGraphEvent;
    let stopGraphEvents;
    const { newGroups: initialRootGroups, newStreams: initialRootStreams } = maybeIntegrateWork(initialWork);
    const nonEmptyInitialRootGroups = pruneEmptyGroups(initialRootGroups);
    for (const group of nonEmptyInitialRootGroups) {
        rootGroups.add(group);
    }
    for (const stream of initialRootStreams) {
        rootStreams.add(stream);
    }
    const events = new Queue_ts_1.Queue(({ push: _push, stop: _stop, onStop, started }) => {
        pushGraphEvent = _push;
        stopGraphEvents = _stop;
        started.then(() => {
            for (const group of rootGroups) {
                startGroup(group);
            }
            for (const stream of rootStreams) {
                startStream(stream);
            }
        });
        onStop((reason) => cancel(reason));
    }, 1).subscribe((graphEvents) => handleGraphEvents(graphEvents));
    return {
        initialGroups: nonEmptyInitialRootGroups,
        initialStreams: initialRootStreams,
        events,
    };
    function cancel(reason) {
        const cancelPromises = [];
        for (const group of rootGroups) {
            cancelGroup(group, reason, cancelPromises);
        }
        for (const stream of rootStreams) {
            cancelStream(stream, reason, cancelPromises);
        }
        if (cancelPromises.length > 0) {
            return Promise.allSettled(cancelPromises).then(() => undefined);
        }
    }
    function cancelGroup(group, reason, cancelPromises) {
        const groupNode = groupNodes.get(group);
        if (groupNode) {
            for (const task of groupNode.tasks) {
                cancelTask(task, reason, cancelPromises);
            }
            for (const childGroup of groupNode.childGroups) {
                cancelGroup(childGroup, reason, cancelPromises);
            }
        }
    }
    function cancelTask(task, reason, cancelPromises) {
        const abortResult = task.computation.abort(reason);
        if ((0, isPromise_ts_1.isPromise)(abortResult)) {
            cancelPromises.push(abortResult);
        }
        const taskNode = taskNodes.get(task);
        if (taskNode) {
            for (const childStream of taskNode.childStreams) {
                cancelStream(childStream, reason, cancelPromises);
            }
        }
    }
    function cancelStream(stream, reason, cancelPromises) {
        const abortResult = stream.queue.abort(reason);
        if ((0, isPromise_ts_1.isPromise)(abortResult)) {
            cancelPromises.push(abortResult);
        }
    }
    function maybeIntegrateWork(work, parentTask) {
        if (!work) {
            return { newGroups: [], newStreams: [] };
        }
        const { groups, tasks, streams } = work;
        const newGroups = groups ? addGroups(groups, parentTask) : [];
        if (tasks) {
            for (const task of tasks) {
                addTask(task);
            }
        }
        const newStreams = streams ? addStreams(streams, parentTask) : [];
        return { newGroups, newStreams };
    }
    function addGroups(originalGroups, parentTask) {
        const groupSet = new Set(originalGroups);
        const visited = new Set();
        const newRootGroups = [];
        for (const group of originalGroups) {
            addGroup(group, groupSet, newRootGroups, visited, parentTask);
        }
        return newRootGroups;
    }
    function addGroup(group, groupSet, newRootGroups, visited, parentTask) {
        if (visited.has(group)) {
            return;
        }
        visited.add(group);
        const parent = group.parent;
        if (parent !== undefined) {
            if (groupSet.has(parent)) {
                addGroup(parent, groupSet, newRootGroups, visited, parentTask);
            }
            if (!groupNodes.has(parent)) {
                return;
            }
        }
        const groupNode = {
            childGroups: [],
            tasks: new Set(),
            pending: 0,
        };
        groupNodes.set(group, groupNode);
        if (parentTask === undefined && !parent) {
            newRootGroups.push(group);
        }
        else if (parent) {
            groupNodes.get(parent)?.childGroups.push(group);
        }
    }
    function addTask(task) {
        for (const group of task.groups) {
            const groupNode = groupNodes.get(group);
            if (groupNode) {
                groupNode.tasks.add(task);
                groupNode.pending++;
                if (rootGroups.has(group)) {
                    startTask(task);
                }
            }
        }
    }
    function addStreams(streams, parentTask) {
        if (!parentTask) {
            return streams;
        }
        const taskNode = taskNodes.get(parentTask);
        if (taskNode) {
            taskNode.childStreams.push(...streams);
        }
        return [];
    }
    function pruneEmptyGroups(newGroups, nonEmptyNewGroups = []) {
        for (const newGroup of newGroups) {
            const newGroupState = groupNodes.get(newGroup);
            if (newGroupState) {
                if (newGroupState.tasks.size === 0) {
                    groupNodes.delete(newGroup);
                    pruneEmptyGroups(newGroupState.childGroups, nonEmptyNewGroups);
                }
                else {
                    nonEmptyNewGroups.push(newGroup);
                }
            }
        }
        return nonEmptyNewGroups;
    }
    function startNewWork(newGroups, newStreams) {
        const groupEvents = [];
        const groupsToStart = [...newGroups];
        const streamsToStart = [...newStreams];
        for (const group of groupsToStart) {
            rootGroups.add(group);
            startGroup(group);
            const groupNode = groupNodes.get(group);
            if (groupNode) {
                maybeFinishGroup(group, groupNode, groupEvents, groupsToStart, streamsToStart);
            }
        }
        for (const stream of streamsToStart) {
            rootStreams.add(stream);
            startStream(stream);
        }
        return groupEvents;
    }
    function startGroup(group) {
        const groupNode = groupNodes.get(group);
        if (groupNode) {
            for (const task of groupNode.tasks) {
                startTask(task);
            }
        }
    }
    function startTask(task) {
        const alreadyStarted = taskNodes.has(task);
        if (!alreadyStarted) {
            taskNodes.set(task, {
                value: undefined,
                childStreams: [],
            });
        }
        try {
            const result = task.computation.result();
            if (alreadyStarted) {
                return;
            }
            if ((0, isPromise_ts_1.isPromise)(result)) {
                result.then((resolved) => {
                    pushGraphEvent({ kind: 'TASK_SUCCESS', task, result: resolved });
                }, (error) => {
                    pushGraphEvent({ kind: 'TASK_FAILURE', task, error });
                });
            }
            else {
                pushGraphEvent({ kind: 'TASK_SUCCESS', task, result });
            }
        }
        catch (error) {
            pushGraphEvent({ kind: 'TASK_FAILURE', task, error });
        }
    }
    async function startStream(stream) {
        try {
            await stream.queue.forEachBatch(async (items) => {
                const pushed = pushGraphEvent({
                    kind: 'STREAM_ITEMS',
                    stream,
                    items,
                });
                if ((0, isPromise_ts_1.isPromise)(pushed)) {
                    await pushed;
                }
            });
            pushGraphEvent({ kind: 'STREAM_SUCCESS', stream });
        }
        catch (error) {
            pushGraphEvent({ kind: 'STREAM_FAILURE', stream, error });
        }
    }
    function handleGraphEvents(graphEvents) {
        const workQueueEvents = [];
        for (const graphEvent of graphEvents) {
            switch (graphEvent.kind) {
                case 'TASK_SUCCESS':
                    workQueueEvents.push(...taskSuccess(graphEvent));
                    break;
                case 'TASK_FAILURE':
                    workQueueEvents.push(...taskFailure(graphEvent));
                    break;
                case 'STREAM_ITEMS':
                    workQueueEvents.push(...streamItems(graphEvent));
                    break;
                case 'STREAM_SUCCESS':
                    if (rootStreams.has(graphEvent.stream)) {
                        rootStreams.delete(graphEvent.stream);
                        workQueueEvents.push(graphEvent);
                    }
                    break;
                case 'STREAM_FAILURE':
                    rootStreams.delete(graphEvent.stream);
                    workQueueEvents.push(graphEvent);
                    break;
            }
        }
        if (rootGroups.size === 0 && rootStreams.size === 0) {
            stopGraphEvents();
            workQueueEvents.push({ kind: 'WORK_QUEUE_TERMINATION' });
        }
        return workQueueEvents.length > 0 ? workQueueEvents : undefined;
    }
    function taskSuccess(graphEvent) {
        const { task, result } = graphEvent;
        const { value, work } = result;
        const taskNode = taskNodes.get(task);
        if (!taskNode) {
            return [];
        }
        taskNode.value = value;
        maybeIntegrateWork(work, task);
        const groupEvents = [];
        const newGroups = [];
        const newStreams = [];
        for (const group of task.groups) {
            const groupNode = groupNodes.get(group);
            if (groupNode) {
                groupNode.pending--;
                maybeFinishGroup(group, groupNode, groupEvents, newGroups, newStreams);
            }
        }
        return [...groupEvents, ...startNewWork(newGroups, newStreams)];
    }
    function maybeFinishGroup(group, groupNode, groupEvents, newGroups, newStreams) {
        if (!rootGroups.has(group)) {
            return;
        }
        if (groupNode.pending === 0) {
            const { groupValuesEvent, groupSuccessEvent, newGroups: childNewGroups, newStreams: childNewStreams, } = finishGroupSuccess(group, groupNode);
            if (groupValuesEvent) {
                groupEvents.push(groupValuesEvent);
            }
            groupEvents.push(groupSuccessEvent);
            newGroups.push(...childNewGroups);
            newStreams.push(...childNewStreams);
        }
    }
    function taskFailure(graphEvent) {
        const { task, error } = graphEvent;
        if (!taskNodes.has(task)) {
            return [];
        }
        const groupFailureEvents = [];
        for (const group of task.groups) {
            const groupNode = groupNodes.get(group);
            if (groupNode && rootGroups.has(group)) {
                groupFailureEvents.push(finishGroupFailure(group, groupNode, error));
            }
        }
        return groupFailureEvents;
    }
    function streamItems(graphEvent) {
        const { stream, items } = graphEvent;
        const values = [];
        const newGroups = [];
        const newStreams = [];
        for (const { value, work } of items) {
            const { newGroups: itemNewGroups, newStreams: itemNewStreams } = maybeIntegrateWork(work);
            const nonEmptyNewGroups = pruneEmptyGroups(itemNewGroups);
            const groupEvents = startNewWork(nonEmptyNewGroups, itemNewStreams);
            if (!(groupEvents.length === 0))
                (0, invariant_ts_1.invariant)(false);
            values.push(value);
            newGroups.push(...nonEmptyNewGroups);
            newStreams.push(...itemNewStreams);
        }
        const streamValuesEvent = {
            kind: 'STREAM_VALUES',
            stream,
            values,
            newGroups,
            newStreams,
        };
        if (stream.queue.isStopped()) {
            rootStreams.delete(stream);
            return [streamValuesEvent, { kind: 'STREAM_SUCCESS', stream }];
        }
        return [streamValuesEvent];
    }
    function finishGroupSuccess(group, groupNode) {
        groupNodes.delete(group);
        const values = [];
        const newStreams = [];
        for (const task of groupNode.tasks) {
            const taskNode = taskNodes.get(task);
            if (taskNode) {
                const { value, childStreams } = taskNode;
                if (value !== undefined) {
                    values.push(value);
                }
                for (const childStream of childStreams) {
                    newStreams.push(childStream);
                }
                removeTask(task);
            }
        }
        const newGroups = pruneEmptyGroups(groupNode.childGroups);
        rootGroups.delete(group);
        return {
            groupValuesEvent: values.length
                ? { kind: 'GROUP_VALUES', group, values }
                : undefined,
            groupSuccessEvent: {
                kind: 'GROUP_SUCCESS',
                group,
                newGroups,
                newStreams,
            },
            newGroups,
            newStreams,
        };
    }
    function finishGroupFailure(group, groupNode, error) {
        removeGroup(group, groupNode);
        return { kind: 'GROUP_FAILURE', group, error };
    }
    function removeGroup(group, groupNode) {
        rootGroups.delete(group);
        groupNodes.delete(group);
        for (const task of groupNode.tasks) {
            if (task.groups.every((taskGroup) => !groupNodes.has(taskGroup))) {
                removeTask(task);
            }
        }
        for (const childGroup of groupNode.childGroups) {
            const childGroupState = groupNodes.get(childGroup);
            if (childGroupState) {
                removeGroup(childGroup, childGroupState);
            }
        }
    }
    function removeTask(task) {
        for (const group of task.groups) {
            const groupNode = groupNodes.get(group);
            groupNode?.tasks.delete(task);
        }
        taskNodes.delete(task);
    }
}
//# sourceMappingURL=WorkQueue.js.map