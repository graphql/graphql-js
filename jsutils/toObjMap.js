"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toObjMapWithSymbols = exports.toObjMap = void 0;
function toObjMap(obj) {
    if (obj == null) {
        return Object.create(null);
    }
    if (Object.getPrototypeOf(obj) === null) {
        return obj;
    }
    const map = Object.create(null);
    for (const [key, value] of Object.entries(obj)) {
        map[key] = value;
    }
    return map;
}
exports.toObjMap = toObjMap;
function toObjMapWithSymbols(obj) {
    if (obj == null) {
        return Object.create(null);
    }
    if (Object.getPrototypeOf(obj) === null) {
        return obj;
    }
    const map = Object.create(null);
    for (const [key, value] of Object.entries(obj)) {
        map[key] = value;
    }
    for (const key of Object.getOwnPropertySymbols(obj)) {
        map[key] = obj[key];
    }
    return map;
}
exports.toObjMapWithSymbols = toObjMapWithSymbols;
//# sourceMappingURL=toObjMap.js.map