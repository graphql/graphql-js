"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalize = capitalize;
/**
 * Converts the first character of string to upper case and the remaining to lower case.
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
//# sourceMappingURL=capitalize.js.map