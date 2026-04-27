type AnyFn = (...args: Array<any>) => any;

export interface MethodSpy {
  readonly callCount: number;
}

export type SpyFn<T extends AnyFn> = T & MethodSpy;

export function spyOn<T extends AnyFn>(fn: T): SpyFn<T> {
  let callCount = 0;

  const spy = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    callCount += 1;
    return fn.apply(this, args) as ReturnType<T>;
  };

  Object.defineProperty(spy, 'callCount', {
    get() {
      return callCount;
    },
    enumerable: true,
  });

  return spy as unknown as SpyFn<T>;
}

export function spyOnMethod<T extends object>(
  target: T,
  key: keyof T,
): MethodSpy {
  const original = target[key];

  if (typeof original !== 'function') {
    throw new Error(
      `Cannot spy on '${String(key)}' because it is not a function.`,
    );
  }

  const spy = spyOn(original as unknown as AnyFn);
  target[key] = spy as T[keyof T];
  return spy;
}
