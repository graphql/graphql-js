/* eslint-disable node/no-unpublished-import */

import React from 'react';

type ApiTokenKind =
  | 'keyword'
  | 'literal'
  | 'name'
  | 'parameter'
  | 'property'
  | 'type';
type ApiPart =
  | string
  | readonly [ApiTokenKind, string]
  | readonly ['link', string, string];

export function ApiSignature({ parts }: { parts: ReadonlyArray<ApiPart> }) {
  return (
    <pre className="api-signature roboto-mono">
      <code>{renderApiParts(parts)}</code>
    </pre>
  );
}

export function ApiType({ parts }: { parts: ReadonlyArray<ApiPart> }) {
  return <code className="api-type roboto-mono">{renderApiParts(parts)}</code>;
}

function renderApiParts(parts: ReadonlyArray<ApiPart>) {
  return parts.map((part, index) => {
    if (typeof part === 'string') {
      return part;
    }

    const [kind, value] = part;
    if (kind === 'link') {
      return (
        <a key={index} className="api-signature-type" href={part[2]}>
          {value}
        </a>
      );
    }

    return (
      <span key={index} className={`api-signature-${kind}`}>
        {value}
      </span>
    );
  });
}
