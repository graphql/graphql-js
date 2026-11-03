import { invariant } from "./invariant.mjs";
export function orList(items) {
    return formatList('or', items);
}
export function andList(items) {
    return formatList('and', items);
}
function formatList(conjunction, items) {
    if (!(items.length !== 0))
        invariant(false);
    switch (items.length) {
        case 1:
            return items[0];
        case 2:
            return items[0] + ' ' + conjunction + ' ' + items[1];
    }
    const allButLast = items.slice(0, -1);
    const lastItem = items.at(-1);
    return allButLast.join(', ') + ', ' + conjunction + ' ' + lastItem;
}
//# sourceMappingURL=formatList.mjs.map