import { memoize3 } from '../jsutils/memoize3.ts';

import type { GraphQLObjectType } from '../type/definition.ts';

import type { FieldDetailsList } from './collectFields.ts';
import { collectSubfields as _collectSubfields } from './collectFields.ts';
import type { ValidatedExecutionArgs } from './ExecutionArgs.ts';

/** @internal */
export const collectSubfields: (
  validatedExecutionArgs: ValidatedExecutionArgs,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
) => ReturnType<typeof _collectSubfields> = memoize3(
  (
    validatedExecutionArgs: ValidatedExecutionArgs,
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
  ) => {
    const { schema, fragments, variableValues, hideSuggestions } =
      validatedExecutionArgs;
    return _collectSubfields(
      schema,
      fragments,
      variableValues,
      returnType,
      fieldDetailsList,
      hideSuggestions,
    );
  },
);
