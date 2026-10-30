import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
const LineRegExp = /\r\n|[\n\r]/g;
export function getLocation(source, position) {
    const matches = source.body.matchAll(LineRegExp);
    let match = matches.next().value;
    let line = 1;
    let lastLineStart = 0;
    while (match !== undefined && match.index < position) {
        lastLineStart = match.index + match[0].length;
        line++;
        match = matches.next().value;
    }
    return { line, column: position + 1 - lastLineStart };
}
export function getLocations(locations) {
    if (locations.length < 2) {
        return locations.map(({ source, start }) => getLocation(source, start));
    }
    const bySource = new AccumulatorMap();
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