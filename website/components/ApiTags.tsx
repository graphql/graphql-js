/* eslint-disable node/no-unpublished-import, prefer-object-spread */

import { useRouter } from 'next/router';
import React, { type CSSProperties, type ReactNode } from 'react';

export type ApiTagKind = 'deprecated';

interface ApiTagInfo {
  border: string;
  background: string;
  color: string;
}

interface ApiTagInfoMap {
  deprecated: ApiTagInfo;
}

const tagInfo: ApiTagInfoMap = {
  deprecated: {
    border: '#fbbf24',
    background: '#fffbeb',
    color: '#92400e',
  },
};

const baseTagStyle: CSSProperties = {
  alignItems: 'center',
  borderRadius: '999px',
  borderStyle: 'solid',
  borderWidth: '1px',
  display: 'inline-flex',
  fontSize: '0.72rem',
  fontWeight: 600,
  gap: '0.25rem',
  lineHeight: 1.2,
  marginLeft: '0.35rem',
  padding: '0.12rem 0.42rem',
  verticalAlign: '0.08rem',
  whiteSpace: 'nowrap',
};

export function ApiTag({
  children,
  kind,
  title,
}: {
  children?: ReactNode;
  kind: ApiTagKind;
  title?: string;
}) {
  const { asPath } = useRouter();
  const info = tagInfo[kind];
  const version = /^\/api-v(\d+)(?:\/|$)/.exec(asPath)?.[1];
  const label =
    kind === 'deprecated' && version != null
      ? `Deprecated in v${version}`
      : 'Deprecated';
  const tagTitle =
    kind === 'deprecated' && version != null
      ? `Deprecated in GraphQL.js v${version}. Prefer the documented replacement.`
      : 'Deprecated in GraphQL.js. Prefer the documented replacement.';
  const style = Object.assign({}, baseTagStyle, {
    background: info.background,
    borderColor: info.border,
    color: info.color,
  });

  return (
    <span
      aria-label={title ?? tagTitle}
      title={title ?? tagTitle}
      style={style}
    >
      {children ?? label}
    </span>
  );
}

export function ApiSignature({ children }: { children?: ReactNode }) {
  return (
    <pre className="api-signature roboto-mono">
      <code>{children}</code>
    </pre>
  );
}

export function ApiType({ children }: { children?: ReactNode }) {
  return <code className="api-type roboto-mono">{children}</code>;
}
