"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocation = getLocation;
exports.getLocations = getLocations;
const AccumulatorMap_ts_1 = require("../jsutils/AccumulatorMap.js");
const LineRegExp = /\r\n|[\n\r]/g;
function getLocation(source, position) {
    return getLocations([{ source, start: position }])[0];
}
function getLocations(locations) {
    const bySource = new AccumulatorMap_ts_1.AccumulatorMap();
    locations.forEach(({ source, start }, index) => {
        bySource.add(source, {
            position: start,
            index,
        });
    });
    const result = new Array(locations.length);
    for (const [source, positions] of bySource) {
        const matches = source.body.matchAll(LineRegExp);
        let match = matches.next().value;
        let line = 1;
        let lastLineStart = 0;
        for (const { position, index } of positions.toSorted((a, b) => a.position - b.position)) {
            while (match !== undefined && match.index < position) {
                lastLineStart = match.index + match[0].length;
                line++;
                match = matches.next().value;
            }
            result[index] = {
                line,
                column: position + 1 - lastLineStart,
            };
        }
    }
    return result;
}
//# sourceMappingURL=location.js.map