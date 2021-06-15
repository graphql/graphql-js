/**
 * Generator that produces all possible combinations of allowed characters.
 */
export function* genFuzzStrings(options: {
  allowedChars: ReadonlyArray<string>;
  maxLength: number;
}): Generator<string, void, void> {
  const { allowedChars, maxLength } = options;
  const numAllowedChars = allowedChars.length;

  let numCombinations = 0;
  for (let length = 1; length <= maxLength; ++length) {
    numCombinations += numAllowedChars ** length;
  }

  yield ''; // special case for empty string
  for (let combination = 0; combination < numCombinations; ++combination) {
    let permutation = '';

    let leftOver = combination;
    while (leftOver >= 0) {
      const reminder = leftOver % numAllowedChars;
      permutation = allowedChars[reminder] + permutation;
      leftOver = (leftOver - reminder) / numAllowedChars - 1;
    }

    yield permutation;
  }
}
