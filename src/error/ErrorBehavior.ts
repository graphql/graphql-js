export type GraphQLErrorBehavior = 'NO_PROPAGATE' | 'PROPAGATE' | 'ABORT';

export function isErrorBehavior(
  onError: unknown,
): onError is GraphQLErrorBehavior {
  return (
    onError === 'NO_PROPAGATE' || onError === 'PROPAGATE' || onError === 'ABORT'
  );
}
