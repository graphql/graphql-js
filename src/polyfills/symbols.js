// In ES2015 (or a polyfilled) environment, this will be Symbol.iterator
// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
export const SYMBOL_ITERATOR: string =
  typeof Symbol === 'function' && Boolean(Symbol.iterator)
    ? Symbol.iterator
    : '@@iterator';

// In ES2017 (or a polyfilled) environment, this will be Symbol.asyncIterator
// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
export const SYMBOL_ASYNC_ITERATOR: string =
  typeof Symbol === 'function' && Boolean(Symbol.asyncIterator)
    ? Symbol.asyncIterator
    : '@@asyncIterator';

// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
export const SYMBOL_TO_STRING_TAG: string =
  typeof Symbol === 'function' && Boolean(Symbol.toStringTag)
    ? Symbol.toStringTag
    : '@@toStringTag';
