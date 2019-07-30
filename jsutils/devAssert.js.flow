// @flow strict

/* istanbul ignore file */
export default function devAssert(condition: mixed, message: string): void {
  const booleanCondition = Boolean(condition);
  /* istanbul ignore else */
  if (!booleanCondition) {
    throw new Error(message);
  }
}
