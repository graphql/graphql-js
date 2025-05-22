export type ErrorBehavior = 'NO_PROPAGATE' | 'PROPAGATE' | 'ABORT';

export function isErrorBehavior(onError: unknown): onError is ErrorBehavior {
  return (
    onError === 'NO_PROPAGATE' || onError === 'PROPAGATE' || onError === 'ABORT'
  );
}
