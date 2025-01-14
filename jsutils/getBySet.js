"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBySet = getBySet;
const isSameSet_js_1 = require("./isSameSet.js");
function getBySet(map, setToMatch) {
    for (const set of map.keys()) {
        if ((0, isSameSet_js_1.isSameSet)(set, setToMatch)) {
            return map.get(set);
        }
    }
    return undefined;
}
//# sourceMappingURL=getBySet.js.map