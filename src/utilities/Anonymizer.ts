import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';

import type {
  ASTNode,
  DocumentNode,
  FloatValueNode,
  IntValueNode,
  NameNode,
  StringValueNode,
} from '../language/ast';
import { isNode } from '../language/ast';
import { Kind } from '../language/kinds';
import { parseValue } from '../language/parser';
import type { ASTVisitor } from '../language/visitor';
import { visit } from '../language/visitor';

import { GraphQLSchema } from '../type/schema';
import { specifiedScalarTypes } from '../type/scalars';

import { TypeInfo, visitWithTypeInfo } from './TypeInfo';

interface AnonymizerOptions {
  hashSalt: string;
  hashFunction: (value: ArrayBuffer) => Promise<ArrayBuffer>;
  safeListedSchema?: GraphQLSchema | null;
}

export class Anonymizer {
  private _valueMap: Map<string, string> = new Map();
  private _safeListedSchema: GraphQLSchema | null;
  private _hashFunction: (value: ArrayBuffer) => Promise<ArrayBuffer>;
  private _hashSalt: string;

  constructor(options: AnonymizerOptions) {
    const {
      hashSalt,
      hashFunction,
      safeListedSchema = new GraphQLSchema({ types: specifiedScalarTypes }),
    } = options;

    this._safeListedSchema = safeListedSchema;
    this._hashSalt = hashSalt;
    this._hashFunction = hashFunction;
  }

  get [Symbol.toStringTag]() {
    return 'Anonymizer';
  }

  async anonymizeDocumentNode(
    documentAST: DocumentNode,
  ): Promise<DocumentNode> {
    const nodesToAnonymize: Array<
      NameNode | StringValueNode | IntValueNode | FloatValueNode
    > = [];

    const typeInfo =
      this._safeListedSchema !== null
        ? new TypeInfo(this._safeListedSchema)
        : null;
    const safeListedSchema = this._safeListedSchema;
    const visitor: ASTVisitor = {
      Name(node, key, parent) {
        if (
          safeListedSchema === null ||
          typeInfo === null ||
          !isSafeListedName(safeListedSchema, typeInfo, node, key, parent)
        ) {
          nodesToAnonymize.push(node);
        }
      },
      StringValue(node) {
        nodesToAnonymize.push(node);
      },
      IntValue(node) {
        nodesToAnonymize.push(node);
      },
      FloatValue(node) {
        nodesToAnonymize.push(node);
      },
    };

    const typeInfoVisitor =
      typeInfo !== null ? visitWithTypeInfo(typeInfo, visitor) : visitor;
    visit(documentAST, typeInfoVisitor);

    const anonymizedValues = await Promise.all(
      nodesToAnonymize.map(({ value }) => this.anonymizeStringValue(value)),
    );

    const anonymizedMap = new Map<ASTNode, ASTNode>();
    for (const [i, value] of anonymizedValues.entries()) {
      const node = nodesToAnonymize[i];
      anonymizedMap.set(node, { ...node, loc: undefined, value });
    }

    return visit(documentAST, {
      enter(node) {
        const anonymizedNode = anonymizedMap.get(node);
        if (anonymizedNode !== undefined) {
          return anonymizedNode;
        }

        return {
          ...node,
          // Remove `loc` on all nodes
          loc: undefined,
        };
      },
    });
  }

  async anonymizeValue(oldValue: unknown): Promise<unknown> {
    switch (typeof oldValue) {
      case 'undefined':
      case 'boolean':
        return oldValue;
      case 'number':
        return Number.isFinite(oldValue)
          ? Number(await this.anonymizeStringValue(oldValue.toString()))
          : oldValue;
      case 'bigint':
        return BigInt(await this.anonymizeStringValue(oldValue.toString()));
      case 'string':
        return this.anonymizeStringValue(oldValue);
      case 'symbol':
        throw new TypeError('Can not anonymize symbol:' + inspect(oldValue));
      case 'function':
        throw new TypeError('Can not anonymize function:' + inspect(oldValue));
      case 'object':
        if (oldValue === null) {
          return oldValue;
        }

        if (Array.isArray(oldValue)) {
          return Promise.all(oldValue.map((item) => this.anonymizeValue(item)));
        }

        if (isPlainObject(oldValue)) {
          return Object.fromEntries(
            await Promise.all(
              Object.entries(oldValue).map(async ([key, value]) => [
                await this.anonymizeStringValue(key),
                await this.anonymizeValue(value),
              ]),
            ),
          );
        }
        throw new TypeError('Can not anonymize object:' + inspect(oldValue));
    }
  }

  async anonymizeStringValue(oldValue: string): Promise<string> {
    const mappedNewValue = this._valueMap.get(oldValue);
    if (mappedNewValue !== undefined) {
      return mappedNewValue;
    }

    const encoder = new TextEncoder();
    const hash = await this._hashFunction(
      encoder.encode(this._hashSalt + oldValue).buffer,
    );
    const newValue = generateNewValue(hash, oldValue);
    this._valueMap.set(oldValue, newValue);
    return newValue;
  }
}

function isSafeListedName(
  safeListedSchema: GraphQLSchema,
  typeInfo: TypeInfo,
  nameNode: NameNode,
  key: string | number | undefined,
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
): boolean {
  invariant(isNode(parent) && typeof key === 'string');

  switch (parent.kind) {
    case Kind.FIELD:
      if (key === 'name') {
        return typeInfo.getFieldDef() != null;
      }
      return false;
    case Kind.ARGUMENT:
      return typeInfo.getArgument() != null;
    case Kind.OBJECT_FIELD:
      return typeInfo.getInputType() != null;
    case Kind.DIRECTIVE:
      return typeInfo.getDirective() != null;
    case Kind.NAMED_TYPE:
      return safeListedSchema.getType(nameNode.value) !== undefined;

    case Kind.DIRECTIVE_DEFINITION:
      return safeListedSchema.getDirective(nameNode.value) !== undefined;
    case Kind.SCALAR_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.SCALAR_TYPE_EXTENSION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_EXTENSION:
    case Kind.UNION_TYPE_EXTENSION:
    case Kind.ENUM_TYPE_EXTENSION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return safeListedSchema.getType(nameNode.value) !== undefined;

    case Kind.FIELD_DEFINITION:
    case Kind.INPUT_VALUE_DEFINITION:
    case Kind.ENUM_VALUE_DEFINITION:
      return false;

    default:
      return false;
  }
}

function isPlainObject(object: Object) {
  const prototype = Object.getPrototypeOf(object);
  return prototype === Object.prototype || prototype === null;
}

function generateNewValue(hash: ArrayBuffer, oldValue: string): string {
  const hashNumber = typedArrayToBigInt(hash);
  try {
    const parsedValue = parseValue(oldValue);
    const first32Bit = hashNumber % BigInt(2 ** 32);
    switch (parsedValue.kind) {
      case Kind.INT:
        return first32Bit.toString();
      case Kind.FLOAT:
        return '0.' + first32Bit.toString();
      default:
    }
  } catch (_e) {
    // ignore errors
  }
  return 'h_' + encodeBase62(hashNumber);
}

function typedArrayToBigInt(array: ArrayBuffer): bigint {
  let result = 0n;
  const bytes = new Uint8Array(array);
  for (const [index, byte] of bytes.entries()) {
    result += BigInt(byte) << BigInt((bytes.length - 1 - index) * 8);
  }
  return result;
}

const b62CharacterSet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function encodeBase62(number: bigint): string {
  let result = '';

  let leftOver = number;
  do {
    const reminder = leftOver % 62n;
    result = b62CharacterSet.charAt(Number(reminder)) + result;
    leftOver = (leftOver - reminder) / 62n;
  } while (leftOver > 0n);

  return result;
}
