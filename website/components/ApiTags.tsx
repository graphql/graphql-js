/* eslint-disable node/no-unpublished-import, prefer-object-spread */

import React, { type CSSProperties, type ReactNode } from 'react';

export type ApiTagKind =
  | 'new-v17'
  | 'changed-v17'
  | 'deprecated-v16'
  | 'deprecated-v17';

interface ApiTagInfo {
  label: string;
  title: string;
  border: string;
  background: string;
  color: string;
}

interface ApiTagInfoMap {
  'new-v17': ApiTagInfo;
  'changed-v17': ApiTagInfo;
  'deprecated-v16': ApiTagInfo;
  'deprecated-v17': ApiTagInfo;
}

const tagInfo: ApiTagInfoMap = {
  'new-v17': {
    label: 'New in v17',
    title: 'Added in GraphQL.js v17.',
    border: '#86efac',
    background: '#f0fdf4',
    color: '#166534',
  },
  'changed-v17': {
    label: 'Changed in v17',
    title:
      'Behavior, signature, or TypeScript shape changed in GraphQL.js v17.',
    border: '#93c5fd',
    background: '#eff6ff',
    color: '#1d4ed8',
  },
  'deprecated-v16': {
    label: 'Deprecated in v16',
    title: 'Deprecated in GraphQL.js v16. Prefer the documented replacement.',
    border: '#fbbf24',
    background: '#fffbeb',
    color: '#92400e',
  },
  'deprecated-v17': {
    label: 'Deprecated in v17',
    title: 'Deprecated in GraphQL.js v17. Prefer the documented replacement.',
    border: '#fda4af',
    background: '#fff1f2',
    color: '#be123c',
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
  const info = tagInfo[kind];
  const style = Object.assign({}, baseTagStyle, {
    background: info.background,
    borderColor: info.border,
    color: info.color,
  });

  return (
    <span
      aria-label={title ?? info.title}
      title={title ?? info.title}
      style={style}
    >
      {children ?? info.label}
    </span>
  );
}
