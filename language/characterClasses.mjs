export function isWhiteSpace(code) {
    return code === 0x0009 || code === 0x0020;
}
export function isDigit(code) {
    return code >= 0x0030 && code <= 0x0039;
}
export function isLetter(code) {
    return ((code >= 0x0061 && code <= 0x007a) ||
        (code >= 0x0041 && code <= 0x005a));
}
export function isNameStart(code) {
    return isLetter(code) || code === 0x005f;
}
export function isNameContinue(code) {
    return isLetter(code) || isDigit(code) || code === 0x005f;
}
//# sourceMappingURL=characterClasses.mjs.map