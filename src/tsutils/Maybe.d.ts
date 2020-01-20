// Conveniently represents flow's "Maybe" type https://flow.org/en/docs/types/maybe/
type Maybe<T> = null | undefined | T;

// See https://github.com/typescript-eslint/typescript-eslint/issues/131
// eslint-disable-next-line no-undef
export default Maybe;
