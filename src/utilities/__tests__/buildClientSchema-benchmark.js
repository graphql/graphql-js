import { buildClientSchema } from '../buildClientSchema';

import bigSchemaIntrospectionResult from '../../__fixtures__/bigSchemaIntrospectionResult';

export const name = 'Build Schema from Introspection';
export const count = 10;
export function measure(): void {
  buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true });
}
