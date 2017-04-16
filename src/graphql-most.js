
import { Source } from './language/source';
import { parse } from './language/parser';
import { validate } from './validation/validate';
import type { GraphQLSchema } from './type/schema';
import type { ExecutionResult } from './execution/execute';

import { executeMost } from './execution/execute-most';
import * as Most from 'most';


export function graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
) {
  return Most.empty().continueWith(() => {
    try {
      const source = new Source(requestString || '', 'GraphQL request');
      const documentAST = parse(source);
      const validationErrors = validate(schema, documentAST);
      if (validationErrors.length > 0) {
        return Most.of({ errors: validationErrors });
      }

      return executeMost(
        schema,
        documentAST,
        rootValue,
        contextValue,
        variableValues,
        operationName
      ).recoverWith(error => {
        return Most.of({ errors: [ error ] });
      });
    } catch (error) {
      return Most.of({ errors: [ error ] });
    }
  });
}
