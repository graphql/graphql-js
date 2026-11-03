import assert from 'node:assert/strict';

import type { ParserOptions } from 'prettier';
import { parsers } from 'prettier/plugins/markdown';
import ts from 'typescript';

export interface JSDocExample {
  code: string;
  language: string;
  metadata: string;
  // The first code line, for diagnostics in the original source file.
  line: number;
  // The code range and comment prefix, for replacing formatted examples.
  start: number;
  end: number;
  prefix: string;
}

export async function extractJSDocExamples(
  text: string,
  filename: string,
): Promise<Array<JSDocExample>> {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const comments = new Map<number, ts.JSDoc>();
  function visit(node: ts.Node): void {
    for (const comment of ts.getJSDocCommentsAndTags(node)) {
      if (ts.isJSDoc(comment)) {
        comments.set(comment.pos, comment);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const results = await Promise.all(
    [...comments.values()]
      .sort((a, b) => a.pos - b.pos)
      .map((comment) => extractCommentExamples(source, comment)),
  );
  return results.flat();
}

export interface SourceEdit {
  start: number;
  end: number;
  text: string;
}

export function applyEdits(
  code: string,
  edits: ReadonlyArray<SourceEdit>,
): string {
  // Apply changes from the end so earlier source offsets remain valid.
  let result = code;
  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

async function extractCommentExamples(
  source: ts.SourceFile,
  comment: ts.JSDoc,
): Promise<Array<JSDocExample>> {
  const examples: Array<JSDocExample> = [];
  // Read the full comment: GraphQL directives inside fences can resemble tags.
  const commentStart = comment.pos + 3;
  const lines = [
    ...source.text
      .slice(commentStart, comment.end - 2)
      .matchAll(/([^\r\n]*)(\r\n?|\n|$)/g),
  ].map((match) => {
    const prefix = /^\s*\*[ \t]?/.exec(match[1])?.[0] ?? '';
    return {
      content: match[1].slice(prefix.length),
      prefix,
      start: commentStart + match.index,
    };
  });
  // Let Markdown determine fence boundaries, language tags, and code indentation.
  const markdown: MarkdownNode = await parsers.markdown.parse(
    lines.map(({ content }) => content).join('\n'),
    {} as ParserOptions,
  );
  const tags = comment.tags ?? [];
  let inExample = false;
  let tagIndex = 0;
  let previousCodeEnd = commentStart;
  for (const node of codeBlocks(markdown)) {
    const opening = node.position.start.line - 1;
    const closing = node.position.end.line - 1;
    for (; tagIndex < tags.length; tagIndex++) {
      const tag = tags[tagIndex];
      if (tag.pos >= lines[opening].start) {
        break;
      }
      if (tag.pos >= previousCodeEnd) {
        inExample = tag.tagName.text === 'example';
      }
    }
    // Code cannot be mistaken for JSDoc tags, regardless of its language.
    previousCodeEnd = lines[closing + 1]?.start ?? comment.end;
    if (!inExample) {
      continue;
    }
    const opener = lines[opening].content.slice(node.position.start.column - 1);
    const fence = /^( *)(`{3,}|~{3,})/.exec(opener);
    if (!fence) {
      continue; // An indented code block has no language tag.
    }
    const [, indent, marker] = fence;
    const continuation = (node.position.indent?.at(-1) ?? 1) - 1;
    const closer = lines[closing].content.slice(continuation);
    const { start } = lines[opening + 1];
    const line = source.getLineAndCharacterOfPosition(start).line + 1;
    assert(
      closing > opening &&
        new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \t]*$`).test(
          closer,
        ),
      `${source.fileName}:${line}: unclosed fence`,
    );
    examples.push({
      line,
      start,
      end: lines[closing].start,
      prefix:
        lines[closing].prefix +
        lines[closing].content.slice(0, continuation) +
        indent,
      metadata: node.meta ?? '',
      code: node.value ?? '',
      language: (node.lang ?? '').toLowerCase(),
    });
  }
  return examples;
}

// Prettier's Markdown parser returns a Markdown syntax tree. Only code block
// values and their source positions are needed here.
interface MarkdownNode {
  type: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  children?: Array<MarkdownNode>;
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    indent?: Array<number>;
  };
}

function* codeBlocks(node: MarkdownNode): Generator<MarkdownNode> {
  if (node.type === 'code') {
    yield node;
  }
  for (const child of node.children ?? []) {
    yield* codeBlocks(child);
  }
}
