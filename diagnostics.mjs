import { isPromiseLike } from "./jsutils/isPromise.mjs";
function resolveDiagnosticsChannel() {
    let dc;
    try {
        const processRef = globalThis.process;
        if (typeof processRef?.getBuiltinModule === 'function') {
            dc = processRef.getBuiltinModule('node:diagnostics_channel');
        }
    }
    catch {
    }
    return dc;
}
const dc = resolveDiagnosticsChannel();
export const parseChannel = dc?.tracingChannel('graphql:parse');
export const validateChannel = dc?.tracingChannel('graphql:validate');
export const executeChannel = dc?.tracingChannel('graphql:execute');
export const executeVariableCoercionChannel = dc?.tracingChannel('graphql:execute:variableCoercion');
export const executeRootSelectionSetChannel = dc?.tracingChannel('graphql:execute:rootSelectionSet');
export const subscribeChannel = dc?.tracingChannel('graphql:subscribe');
export const resolveChannel = dc?.tracingChannel('graphql:resolve');
const SUB_CHANNEL_KEYS = ['start', 'end', 'asyncStart', 'asyncEnd', 'error'];
export function shouldTrace(channel) {
    if (channel == null) {
        return false;
    }
    const aggregate = channel.hasSubscribers;
    if (aggregate !== undefined) {
        return aggregate;
    }
    for (const key of SUB_CHANNEL_KEYS) {
        if (channel[key].hasSubscribers) {
            return true;
        }
    }
    return false;
}
export function traceMixed(channel, contextInput, fn) {
    const context = contextInput;
    return channel.start.runStores(context, () => {
        let result;
        try {
            result = fn();
        }
        catch (err) {
            context.error = err;
            channel.error.publish(context);
            channel.end.publish(context);
            throw err;
        }
        if (!isPromiseLike(result)) {
            context.result = result;
            channel.end.publish(context);
            return result;
        }
        channel.end.publish(context);
        return result.then((value) => {
            context.result = value;
            channel.asyncStart.publish(context);
            channel.asyncEnd.publish(context);
            return value;
        }, (err) => {
            context.error = err;
            channel.error.publish(context);
            channel.asyncStart.publish(context);
            channel.asyncEnd.publish(context);
            throw err;
        });
    });
}
//# sourceMappingURL=diagnostics.mjs.map