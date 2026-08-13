export type GraphQLErrorBehavior = 'NULL' | 'PROPAGATE' | 'ABORT';

export function isErrorBehavior(
  onError: unknown,
): onError is GraphQLErrorBehavior {
  return onError === 'NULL' || onError === 'PROPAGATE' || onError === 'ABORT';
}
