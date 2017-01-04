

// Choose what version of `execute` to be exported for testing


export {
  defaultFieldResolver,
  responsePathAsArray
} from './execute-origin';
export type { ExecutionResult } from './execute-origin';

// For conditional export
import { execute as executeOri } from './execute-origin';
import { execute as executeRx } from './execute-rx';

const mode = process.env.RUN_MODE;

export const execute = (mode === 'Rx') ? executeRx : executeOri;
