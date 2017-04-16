
import { Source } from './language/source';
import { parse } from './language/parser';
import { validate } from './validation/validate';
import type { GraphQLSchema } from './type/schema';
import type { ExecutionResult } from './execution/execute';

import { executeRx } from './execution/execute-rx';
import { Observable } from 'rxjs/Rx';


export function graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): rxjs$Observable<ExecutionResult> {
  return Observable.defer(() => {
    try {
      const source = new Source(requestString || '', 'GraphQL request');
      const documentAST = parse(source);
      const validationErrors = validate(schema, documentAST);
      if (validationErrors.length > 0) {
        return Observable.of({ errors: validationErrors });
      }

      return executeRx(
        schema,
        documentAST,
        rootValue,
        contextValue,
        variableValues,
        operationName
      ).catch(error => {
        return Observable.of({ errors: [ error ] });
      });
    } catch (error) {
      return Observable.of({ errors: [ error ] });
    }
  });
}
