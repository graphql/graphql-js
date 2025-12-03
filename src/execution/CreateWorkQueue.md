## Creating the Work Queue

### Overview

{CreateWorkQueue} returns the initial work and event stream that reports work progress, where the internal state of the queue is represented as an acyclic directed graph with its own internal queue of task completion and stream events. The graph evolves as work proceeds, modeling relationships among groups, tasks, and streams; new nodes may be discovered on internal {TASK_SUCCESS} or {STREAM_ITEMS} events, each which provide a value and optional new work (e.g. new groups, tasks, or streams).

The internal events include:

- {TASK_SUCCESS} reports that a {task} completed successfully with a {result} (containing a {value} and optional {work}).
- {TASK_FAILURE} carries the failed {task} and the causal {error}.
- {STREAM_ITEMS} reports that a {stream} produced one or more {items} (each containing a {value} and optional {work}).
- {STREAM_SUCCESS} announces that a {stream} completed successfully.
- {STREAM_FAILURE} includes both the {stream} and the terminal {error}.

Consumers of the work queue do not see these internal events directly; instead, they receive external events emitted on the returned observable {workEventStream}. These external events summarize progress at the granularity of groups and streams, abstracting away individual task completions. Each event also enumerates any newly visible work segments (groups and streams that became roots) so consumers can react without re-querying the queue's internal state.

The external events include {STREAM_SUCCESS} and {STREAM_FAILURE}, which correspond directly to their internal counterparts, as well as:

- {GROUP_VALUES} delivers the task {values} for a completed root {group} (tasks already surfaced via other groups are omitted).
- {GROUP_SUCCESS} delivers the completed {group}, a list of its task {values} (omitting those task {values} previously delivered within other groups), and any {newGroups}/{newStreams} that became roots.
- {GROUP_FAILURE} carries the failed {group} and the propagated {error}.
- {STREAM_VALUES} reports the producing {stream}, the yielded batch of item {values}, and any {newGroups}/{newStreams} introduced once the batch's {work} is integrated.
- {WORK_QUEUE_TERMINATION} signals that there are no more root groups or streams.

The work event stream concludes when the graph is empty.

### Graph Definition

- Let the graph be {G} = ({V}, {E<sub>gc</sub>}, {E<sub>gt</sub>}, {E<sub>ts</sub>}, {E<sub>tv</sub>}), where:
  - {V} = {V<sub>group</sub>} ∪ {V<sub>task</sub>} ∪ {V<sub>stream</sub>} ∪ {V<sub>value</sub>}.
    ד - {E<sub>gc</sub>} are {group} → {childGroup} edges, capturing that a {childGroup} can begin only after its parent group succeeds.
  - {E<sub>gt</sub>} are {group} → {task} edges.
  - {E<sub>ts</sub>} are {task} → {stream} edges, capturing that a {stream} can begin as soon as its producing {task} yields an item.
  - {E<sub>tv</sub>} are {task} → {value} edges, each pointing to a node that stores the completion value of its source task.
- A root {group} has no incoming edge in {E<sub>gc</sub>}.
- A root {stream} has no incoming edge in {E<sub>ts</sub>}.
- Each {task} may be targeted by more than one {group} via {E<sub>gt</sub>}. A {task} always includes the list of {groups} that target it, as well as a function to execute. A {task} executes once and either fails with an {error} or succeeds with a {value} and optional {work}. The {value} component is stored in a {value} node targeted by {task} via {E<sub>tv</sub>}. Any {work} is immediately integrated (by {IntegrateWork}).
- A {group} completes when every {task} it targets has completed successfully. A {group} fails if any {task} it targets fails.
- A {stream} runs once started, producing zero or more items and then terminating either successfully or with an {error}. Each produced item yields a {value} and optional {work}; the {values} for each batch are reported via the internal {STREAM_ITEMS} event (which drives the external {STREAM_VALUES} event surfaced to consumers) and the {work} is immediately integrated into the graph.

### Creating the Work Queue

This algorithm constructs the internal {graphEventQueue}, initializes the graph with the supplied {groups}, {tasks}, and {streams}, and returns the observable {workEventStream}.

CreateWorkQueue(work):

- Let {graphEventQueue} be a new queue (capacity 1).
- Let {graph} be initially empty.
- Let {maybeEmptyNewGroups} and {newStreams} be the result of {IntegrateWork(work)}.
- Let {newGroups} be the result of {PruneEmptyGroups(maybeEmptyNewGroups)}.
- Call {StartWork(newGroups, newStreams)}.
- Let {workEventStream} be the following event stream (each iteration yields the batch of external events produced while handling one batch of graph events):
  - For each event {e} produced by {graphEventQueue}:
    - If {e} is {TASK_SUCCESS(task, result)}, call {TaskSuccess(task, result)}.
    - If {e} is {TASK_FAILURE(task, error)}, call {TaskFailure(task, error)}.
    - If {e} is {STREAM_ITEMS(stream, items)}, call {StreamItems(stream, items)}.
    - If {e} is {STREAM_SUCCESS(stream)}, call {StreamSuccess(stream)}.
    - If {e} is {STREAM_FAILURE(stream, error)}, call {StreamFailure(stream, error)}.
    - If {graph} has no root groups or root streams, close {workEventStream} and yield {WORK_QUEUE_TERMINATION}.

- Return {newGroups}, {newStreams}, and {workEventStream}.

The following algorithms have access to {graphEventQueue}, {graph}, and {workEventStream}.

#### Integrating and Starting Work

IntegrateWork(work, parentTask):

- Let {groups}, {tasks}, and {streams} be the respective sets drawn from {work} (missing fields denote empty sets).
- Initialize {visitedGroups} to the empty set and {rootGroups} to the empty list.
- For each group {g} in {groups}:
  - Let {maybeRoot} be the result of {AddGroup(g, groups, parentTask, visitedGroups)} to {rootGroups}.
  - If {maybeRoot} is defined, append it to {rootGroups}.
- For each task {t} in {tasks}:
  - Insert {t} into {graph}.
  - Let {groups} be the list of groups that target {t}.
  - For each group {g} in {groups}:
    - Record {g → t}.
  - If {g} is a root and {t} is not-yet-started, call {StartTask(t)}.
- For each stream {s} in {streams}:
  - Insert {s} into {graph}.
  - If {parentTask} is defined, record {parentTask → s}; otherwise {s} is a root.
- Return the newly inserted root {groups} (namely {rootGroups}) and root {streams}.

AddGroup(group, groupSet, parentTask, visitedGroups):

- If {group} is in {visitedGroups}, return.
- Add {group} to {visitedGroups}.
- If {parentTask} is defined, assert that {group} must specify a {parent} group; initial work and stream items are the only sources of root groups.
- If {group} does not specify a {parent} group:
  - Insert {group} into {graph}.
  - Return {group}.
- If {parent} is in {groupSet}:
  - Let {ancestor} be the result of {AddGroup(parent, groupSet, parentTask, visitedGroups)}.
  - Insert {group} into {graph} and record {parent → group}.
  - Return {ancestor}.
- Otherwise, if {parent} is in {graph}:
  - Record {parent → group}.

PruneEmptyGroups(originalGroups):

- Initialize {nonEmptyGroups} to the empty list.
- For each {group} in {originalGroups}:
  - If {group} targets at least one {task}, append {group} to {nonEmptyGroups} and continue to the next {group} in {originalGroups}.
  - Let {maybeEmptyNewGroups} be the set of child groups targeted by {group}.
  - Append the results of {PruneEmptyGroups(maybeEmptyNewGroups)} to {nonEmptyGroups}.
  - Remove {group} from {graph}.
- Return {nonEmptyGroups}.

StartWork(newGroups, newStreams):

- For each {group} in {newGroups}, call {StartGroup(group)}.
- For each {stream} in {newStreams}, call {StartStream(stream)}.

StartGroup(group):

- For each {task} targeted by {group}:
  - Call {StartTask(task)}.

StartTask(task):

- Start executing {task} such that:
  - If and when {task} completes successfully with {result}, enqueue {TaskSuccess(task, result)} onto {graphEventQueue}.
  - If and when {task} fails with {error}, enqueue {TaskFailure(task, error)} onto {graphEventQueue}.

StartStream(stream):

- Drain {stream} such that:
  - On each successfully produced batch of {items}, enqueue {StreamItems(stream, items)} onto {graphEventQueue}.
  - If and when {stream} terminates successfully, enqueue {StreamSuccess(stream)} onto {graphEventQueue}.
  - If and when {stream} terminates with {error}, enqueue {StreamFailure(stream, error)} onto {graphEventQueue}.

### Handling Task Success

{TaskSuccess(task, result)} reconciles a completed task. It first inspects the parent groups: any root group whose tasks are all complete emits {GROUP_SUCCESS}, is removed from the graph, and takes its completed tasks (and their value nodes) with it. Because each task's work is integrated at completion time, removing the group now merely frees newly exposed child groups and downstream streams to become root candidates whose work can be enqueued. Each {GROUP_SUCCESS} event includes the resolved {group}, the {values} map of task results, and any {newGroups}/{newStreams} that surfaced because the {group} left the graph.

TaskSuccess(task, result):

- If {task} is no longer in {graph}, return early.
- Let {value} and {work} be the respective fields of {result}.
- Mark {task} complete by inserting a {value} node {v} into {V<sub>value</sub>} that stores {value} and recording the edge {task → v} in {E<sub>tv</sub>}.
- If {work} exists, call {IntegrateWork(work, task)}.
- For each group {g} with {g → task} (prior to any removal of {task} while iterating):
  - If all {tasks} targeted by {g} are complete and {g} is a root:
    - Call {GroupSuccess(g)}.

GroupSuccess(group):

- Let {values} be the list of {value} entries for each {task} targeted by {group}; tasks themselves are **not** included alongside the values, and ordering is intentionally unspecified.
- Remove {group} from {graph}, along with each child group of {group}, promoting each direct descendant group of {group} to a root group; let {maybeEmptyNewGroups} be the set of such promoted child groups.
- Let {newGroups} be the result of {PruneEmptyGroups(maybeEmptyNewGroups)}.
- For each {newGroup} of {newGroups}:
  - For each {task} targeted by {newGroup}:
    - Call {StartTask(task)}.
- Remove all {task} nodes targeted by {group} along with any associated {value} nodes, promoting each child stream of {task} to a root stream; let {newStreams} be the set of such promoted streams.
- If {values} is non-empty, yield {GROUP_VALUES: { group, values }} on {workEventStream}.
- Yield {GROUP_SUCCESS: { group, values, newGroups, newStreams }} on {workEventStream}.
- Call {StartWork(newGroups, newStreams)}.

### Handling Task Failure

TaskFailure handles the error path for a task by emitting {GROUP_FAILURE}. The payload reports the failed group and the propagated {error} so consumers can surface diagnostics. Because a task failure invalidates all dependent subgraphs, this procedure also tears down orphaned tasks, groups, and streams.

TaskFailure(task, error):

- If {task} is no longer in {graph}, return early.
- For each group {group} with {group → task}:
  - Yield {GROUP_FAILURE: { group, error }} on {workEventStream}.
  - Remove {group} from {graph} along with its descendant groups.
- Remove task nodes not targeted by any other group (tasks that were only targeted by the removed {group} or its removed descendants) and discard any associated {value} or {stream} nodes. Work associated with removed tasks and streams may be cancelled.

### Handling Stream Items

{StreamItems} moves incremental data from a running stream to the consumer. Each {STREAM_ITEMS} event reports the producing {stream}, the yielded batch of item {values}, and any {newGroups}/{newStreams} introduced once each item's {work} is integrated. This event is the only one that carries arbitrary payload data from user-defined streams; all others describe structural progress.

StreamItems(stream, items):

- Let {values}, {newGroups}, and {newStreams} start empty.
- For each {item} in {items}:
  - Let {value} and {work} be the respective fields of {item}.
  - If {work} exists:
    - Let {maybeEmptyItemNewGroups} and {itemNewStreams} be the result of {IntegrateWork(work)}.
    - Append the result of {PruneEmptyGroups(maybeEmptyItemNewGroups)} to {newGroups}.
    - Append {itemNewStreams} to {newStreams}.
  - Append {value} to {values}.
- Call {StartWork(newGroups, newStreams)}.
- Yield {STREAM_VALUES: { stream, values, newGroups, newStreams}} on {workEventStream}, where {newGroups} and {newStreams} denote the nodes that became roots as a result of integrating the batch's {work}.
- If the {stream} queue is already stopped after draining {items}, also yield {STREAM_SUCCESS} and remove {stream} from {graph}.

### Handling Stream Completion

{StreamSuccess} emits a terminal notification for streams, yielding {STREAM_SUCCESS} with the successful stream.

StreamSuccess(stream):

- Yield {STREAM_SUCCESS: { stream: {stream} }} on {workEventStream}
- Remove {stream} from {graph}.

### Handling Stream Errors

{StreamFailure} yields {STREAM_FAILURE} with both {stream} and the causal {error}.

StreamFailure(stream, error):

- Yield {STREAM_FAILURE: { stream: {stream}, error: {error} }}.
- Remove {stream} from {graph}.
