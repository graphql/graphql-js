import type { FragmentSpreadNode } from '../language/ast.js';
import { print } from '../language/printer.js';

/**
 * Create a key that uniquely identifies common fragment spreads.
 * Treats the fragment spread as the source of truth for the key: it
 * does not bother to look up the argument definitions to de-duplicate default-variable args.
 *
 * Using the fragment definition to more accurately de-duplicate common spreads
 * is a potential performance win, but in practice it seems unlikely to be common.
 */
export function keyForFragmentSpread(fragmentSpread: FragmentSpreadNode) {
  const fragmentName = fragmentSpread.name.value;
  const fragmentArguments = fragmentSpread.arguments;
  if (fragmentArguments == null || fragmentArguments.length === 0) {
    return fragmentName;
  }

  const printedArguments: Array<string> = fragmentArguments
    .map(print)
    .sort((a, b) => a.localeCompare(b));
  return fragmentName + '(' + printedArguments.join(',') + ')';
}
