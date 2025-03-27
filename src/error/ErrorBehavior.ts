export type GraphQLErrorBehavior = 'PROPAGATE' | 'NO_PROPAGATE' | 'ABORT';

export function isErrorBehavior(
  onError: unknown,
): onError is GraphQLErrorBehavior {
  return (
    onError === 'PROPAGATE' || onError === 'NO_PROPAGATE' || onError === 'ABORT'
  );
}
