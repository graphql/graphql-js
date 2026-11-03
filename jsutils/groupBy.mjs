import { AccumulatorMap } from "./AccumulatorMap.mjs";
export function groupBy(list, keyFn) {
    const result = new AccumulatorMap();
    for (const item of list) {
        result.add(keyFn(item), item);
    }
    return result;
}
//# sourceMappingURL=groupBy.mjs.map