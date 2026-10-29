"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLError = void 0;
const isObjectLike_ts_1 = require("../jsutils/isObjectLike.js");
const location_ts_1 = require("../language/location.js");
const printLocation_ts_1 = require("../language/printLocation.js");
class GraphQLError extends Error {
    constructor(message, options = {}) {
        const { nodes, source, positions, path, originalError, cause, extensions } = options;
        const hasCause = 'cause' in options;
        const errorCause = hasCause ? cause : originalError;
        const errorOptions = hasCause || originalError != null ? { cause: errorCause } : undefined;
        super(message, errorOptions);
        this.name = 'GraphQLError';
        this.path = path ?? undefined;
        const underlyingError = originalError ?? (cause instanceof Error ? cause : undefined);
        this.originalError = underlyingError;
        this.nodes = undefinedIfEmpty(Array.isArray(nodes) ? nodes : nodes ? [nodes] : undefined);
        const nodeLocations = undefinedIfEmpty(this.nodes
            ?.map((node) => node.loc)
            .filter((loc) => loc != null));
        this.source = source ?? nodeLocations?.[0]?.source;
        this.positions = positions ?? nodeLocations?.map((loc) => loc.start);
        this.locations =
            positions && source
                ? (0, location_ts_1.getLocations)(positions.map((start) => ({ source, start })))
                : nodeLocations && (0, location_ts_1.getLocations)(nodeLocations);
        const originalExtensions = (0, isObjectLike_ts_1.isObjectLike)(underlyingError?.extensions)
            ? underlyingError.extensions
            : undefined;
        this.extensions = extensions ?? originalExtensions ?? Object.create(null);
        Object.defineProperties(this, {
            message: {
                writable: true,
                enumerable: true,
            },
            name: { enumerable: false },
            nodes: { enumerable: false },
            source: { enumerable: false },
            positions: { enumerable: false },
            originalError: { enumerable: false },
        });
        if (originalError?.stack != null) {
            Object.defineProperty(this, 'stack', {
                value: originalError.stack,
                writable: true,
                configurable: true,
            });
        }
        else if (Error.captureStackTrace != null) {
            Error.captureStackTrace(this, GraphQLError);
        }
        else {
            Object.defineProperty(this, 'stack', {
                value: Error().stack,
                writable: true,
                configurable: true,
            });
        }
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLError';
    }
    toString() {
        let output = this.message;
        if (this.nodes) {
            for (const node of this.nodes) {
                if (node.loc) {
                    output += '\n\n' + (0, printLocation_ts_1.printLocation)(node.loc);
                }
            }
        }
        else if (this.source && this.locations) {
            for (const location of this.locations) {
                output += '\n\n' + (0, printLocation_ts_1.printSourceLocation)(this.source, location);
            }
        }
        return output;
    }
    toJSON() {
        const formattedError = {
            message: this.message,
        };
        if (this.locations != null) {
            formattedError.locations = this.locations;
        }
        if (this.path != null) {
            formattedError.path = this.path;
        }
        if (this.extensions != null && Object.keys(this.extensions).length > 0) {
            formattedError.extensions = this.extensions;
        }
        return formattedError;
    }
}
exports.GraphQLError = GraphQLError;
function undefinedIfEmpty(array) {
    return array === undefined || array.length === 0 ? undefined : array;
}
//# sourceMappingURL=GraphQLError.js.map