import { naturalCompare } from "./naturalCompare.mjs";
export function suggestionList(input, options) {
    const optionsByDistance = Object.create(null);
    const lexicalDistance = new LexicalDistance(input);
    const threshold = Math.floor(input.length * 0.4) + 1;
    for (const option of options) {
        const distance = lexicalDistance.measure(option, threshold);
        if (distance !== undefined) {
            optionsByDistance[option] = distance;
        }
    }
    return Object.keys(optionsByDistance).sort((a, b) => {
        const distanceDiff = optionsByDistance[a] - optionsByDistance[b];
        return distanceDiff !== 0 ? distanceDiff : naturalCompare(a, b);
    });
}
class LexicalDistance {
    constructor(input) {
        this._input = input;
        this._inputLowerCase = input.toLowerCase();
        this._inputArray = stringToArray(this._inputLowerCase);
        this._rows = [
            new Array(input.length + 1).fill(0),
            new Array(input.length + 1).fill(0),
            new Array(input.length + 1).fill(0),
        ];
    }
    measure(option, threshold) {
        if (this._input === option) {
            return 0;
        }
        const optionLowerCase = option.toLowerCase();
        if (this._inputLowerCase === optionLowerCase) {
            return 1;
        }
        let a = stringToArray(optionLowerCase);
        let b = this._inputArray;
        if (a.length < b.length) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        const aLength = a.length;
        const bLength = b.length;
        if (aLength - bLength > threshold) {
            return undefined;
        }
        const rows = this._rows;
        for (let j = 0; j <= bLength; j++) {
            rows[0][j] = j;
        }
        for (let i = 1; i <= aLength; i++) {
            const upRow = rows[(i - 1) % 3];
            const currentRow = rows[i % 3];
            let smallestCell = (currentRow[0] = i);
            for (let j = 1; j <= bLength; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                let currentCell = Math.min(upRow[j] + 1, currentRow[j - 1] + 1, upRow[j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    const doubleDiagonalCell = rows[(i - 2) % 3][j - 2];
                    currentCell = Math.min(currentCell, doubleDiagonalCell + 1);
                }
                if (currentCell < smallestCell) {
                    smallestCell = currentCell;
                }
                currentRow[j] = currentCell;
            }
            if (smallestCell > threshold) {
                return undefined;
            }
        }
        const distance = rows[aLength % 3][bLength];
        return distance <= threshold ? distance : undefined;
    }
}
function stringToArray(str) {
    const strLength = str.length;
    const array = new Array(strLength);
    for (let i = 0; i < strLength; ++i) {
        array[i] = str.charCodeAt(i);
    }
    return array;
}
//# sourceMappingURL=suggestionList.mjs.map