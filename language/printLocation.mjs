import { getLocation } from "./location.mjs";
export function printLocation(location) {
    return printSourceLocation(location.source, getLocation(location.source, location.start));
}
export function printSourceLocation(source, sourceLocation) {
    const firstLineColumnOffset = source.locationOffset.column - 1;
    const body = ''.padStart(firstLineColumnOffset) + source.body;
    const lineIndex = sourceLocation.line - 1;
    const lineOffset = source.locationOffset.line - 1;
    const lineNum = sourceLocation.line + lineOffset;
    const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
    const columnNum = sourceLocation.column + columnOffset;
    const locationStr = `${source.name}:${lineNum}:${columnNum}\n`;
    const lines = body.split(/\r\n|[\n\r]/g);
    const locationLine = lines[lineIndex];
    if (locationLine.length > 120) {
        const subLines = [];
        for (let i = 0; i < locationLine.length; i += 80) {
            subLines.push(locationLine.slice(i, i + 80));
        }
        const zeroBasedColumn = columnNum - 1;
        const subLineIndex = Math.min(Math.floor(zeroBasedColumn / 80), subLines.length - 1);
        const subLineColumnNum = columnNum - subLineIndex * 80;
        return (locationStr +
            printPrefixedLines([
                [`${lineNum} |`, subLines[0]],
                ...subLines
                    .slice(1, subLineIndex + 1)
                    .map((subLine) => ['|', subLine]),
                ['|', '^'.padStart(subLineColumnNum)],
                ['|', subLines[subLineIndex + 1]],
            ]));
    }
    return (locationStr +
        printPrefixedLines([
            [`${lineNum - 1} |`, lines[lineIndex - 1]],
            [`${lineNum} |`, locationLine],
            ['|', '^'.padStart(columnNum)],
            [`${lineNum + 1} |`, lines[lineIndex + 1]],
        ]));
}
function printPrefixedLines(lines) {
    const existingLines = lines.filter(([_, line]) => line !== undefined);
    const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length));
    return existingLines
        .map(([prefix, line]) => prefix.padStart(padLen) + (line ? ' ' + line : ''))
        .join('\n');
}
//# sourceMappingURL=printLocation.js.map