export function resolveAfterAll<
  T extends Readonly<unknown> | ReadonlyArray<unknown>,
>(result: T, promises: ReadonlyArray<Promise<void>>): Promise<T> {
  return new Promise((resolve, reject) => {
    let numPromises = promises.length;

    const onFulfilled = () => {
      numPromises--;
      if (numPromises === 0) {
        resolve(result);
      }
    };

    const onRejected = (_reason: unknown) => {
      reject(_reason);
    };

    for (const promise of promises) {
      promise.then(onFulfilled, onRejected);
    }
  });
}
