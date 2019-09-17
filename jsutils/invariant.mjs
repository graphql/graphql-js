export default function invariant(condition, message) {
  var booleanCondition = Boolean(condition);

  if (!booleanCondition) {
    throw new Error(message != null ? message : 'Unexpected invariant triggered');
  }
}
