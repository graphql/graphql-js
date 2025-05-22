import type { NameNode } from 'graphql/language';

// Parser class is internal API so so any changes to it are never considered breaking changes.
// We just want to test that we are able to import it.
import { Parser } from 'graphql/language/parser';

const parser = new Parser('foo');
const ast: NameNode = parser.parseName();
