type AnyFn = (...args: Array<any>) => any;

export interface MethodSpy {
  readonly callCount: number;
  restore: () => void;
}

export interface SpyOptions {
  readonly stackMatcher?: (stack: string) => boolean;
}

export type SpyFn<T extends AnyFn> = T & MethodSpy;

export function spyOn<T extends AnyFn>(fn: T, options?: SpyOptions): SpyFn<T> {
  let callCount = 0;

  const spy = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (
      options?.stackMatcher === undefined ||
      options.stackMatcher(new Error().stack ?? '')
    ) {
      callCount += 1;
    }
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
  options?: SpyOptions,
): MethodSpy {
  const original = target[key];
  const wasOwnProperty = Object.hasOwn(target, key);

  if (typeof original !== 'function') {
    throw new Error(
      `Cannot spy on '${String(key)}' because it is not a function.`,
    );
  }

  const spy = spyOn(original as AnyFn, options);
  target[key] = spy as T[keyof T];

  const methodSpy: MethodSpy = {
    get callCount() {
      return spy.callCount;
    },
    restore() {
      if (wasOwnProperty) {
        target[key] = original;
      } else {
        delete target[key];
      }
    },
  };

  return methodSpy;
}
