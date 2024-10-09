export function instanceOf(value: unknown, constructor: Constructor): boolean {
  return value instanceof constructor;
}
interface Constructor extends Function {
  prototype: {
    [Symbol.toStringTag]: string;
  };
}
