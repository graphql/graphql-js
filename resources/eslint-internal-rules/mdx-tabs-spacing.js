/*
 * Nextra <Tabs> blocks mix JSX tags with Markdown children. That boundary is
 * fragile: MDX may accept a Tabs block where the tags, fenced code blocks, and
 * following prose are adjacent, but Prettier will not necessarily recover the
 * safer block structure for us.
 *
 * For example, this input has the unsafe adjacency we want to reject. The
 * fenced JavaScript is intentionally unformatted so the Prettier behavior is
 * visible:
 *
 * <Tabs items={["Code"]}>
 *   <Tabs.Tab>
 * ```js
 * const value={a:1};
 * ```
 *   </Tabs.Tab></Tabs>
 * Next paragraph.
 *
 * Running `prettier --parser mdx` on that input produces this:
 *
 * <Tabs items={["Code"]}>
 *   <Tabs.Tab>
 * ```js
 * const value={a:1};
 * ```
 *   </Tabs.Tab></Tabs>
 * Next paragraph.
 *
 * The formatting problem is that Prettier does not treat the fenced block as a
 * normal Markdown code fence in a Tabs panel: the JavaScript stays unformatted,
 * the fence remains glued to <Tabs.Tab>, the closing tags remain collapsed, and
 * the next paragraph remains glued to </Tabs>.
 *
 * With clear JSX/Markdown boundaries, Prettier formats the fenced JavaScript and
 * keeps the Tabs block readable:
 *
 * <Tabs items={["Code"]}>
 *   <Tabs.Tab>
 *
 * ```js
 * const value = { a: 1 };
 * ```
 *
 *   </Tabs.Tab>
 * </Tabs>
 *
 * Next paragraph.
 *
 * This is intentionally not a general Markdown style rule. It only protects the
 * Nextra Tabs shapes that can survive Prettier in a bad form.
 */

const mdxSourceByFilename = new Map();
const mdxTabsSpacingProcessor = {
  meta: {
    name: 'internal-rules/mdx-tabs-spacing',
  },
  preprocess(text, filename) {
    mdxSourceByFilename.set(filename, text);
    return [''];
  },
  postprocess(messageLists, filename) {
    const source = mdxSourceByFilename.get(filename);
    mdxSourceByFilename.delete(filename);

    return [
      ...messageLists.flat(),
      ...(source == null ? [] : checkMdxTabsSpacing(source)),
    ];
  },
  supportsAutofix: false,
};

function checkMdxTabsSpacing(source) {
  const lines = source.split(/\r?\n/u);
  const messages = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Prettier can collapse or preserve this one-line close in a way that makes
    // later conflict resolution hard to read and easy to break again. Keeping the
    // component close and container close on separate lines gives Markdown a
    // clear block boundary after the final tab panel.
    if (/<\/Tabs\.Tab>\s*<\/Tabs>/.test(line)) {
      report(
        messages,
        lines,
        index,
        line.indexOf('</Tabs.Tab>'),
        'Close </Tabs.Tab> and </Tabs> on separate lines.',
      );
    }

    // A <Tabs> block should start as its own Markdown block. If it is glued to
    // the previous paragraph/list item, MDX still accepts the file, but Prettier
    // can treat the JSX and surrounding Markdown as one construct and preserve
    // surprising layout.
    if (isTabsOpen(trimmed) && index > 0 && !isBlank(lines[index - 1])) {
      report(
        messages,
        lines,
        index,
        line.indexOf('<Tabs'),
        'Add a blank line before <Tabs> blocks.',
      );
    }

    // The closing </Tabs> needs the same protection in the other direction. The
    // bug this guard was added for was exactly a closing Tabs block followed by
    // prose with no blank line; that made the following paragraph part of the
    // same MDX flow and led Prettier to keep an unsafe shape.
    if (
      isTabsClose(trimmed) &&
      index < lines.length - 1 &&
      !isBlank(lines[index + 1])
    ) {
      report(
        messages,
        lines,
        index,
        line.indexOf('</Tabs>'),
        'Add a blank line after </Tabs> blocks.',
      );
    }

    // Fenced code inside a JSX child is only unambiguously Markdown when there is
    // a blank line after <Tabs.Tab>. Without it, MDX/Prettier can handle the
    // fence as adjacent JSX text, and later formatting may not restore the tab
    // panel structure we expect.
    if (
      isTabsTabOpen(trimmed) &&
      index < lines.length - 1 &&
      isCodeFence(lines[index + 1])
    ) {
      report(
        messages,
        lines,
        index,
        line.indexOf('<Tabs.Tab>'),
        'Add a blank line between <Tabs.Tab> and fenced code blocks.',
      );
    }

    // Likewise, the end of a fenced code block should be separated from the
    // closing tab panel tag. This keeps the fence close from being visually and
    // syntactically glued to JSX during conflict resolution and Prettier passes.
    if (
      isCodeFence(line) &&
      index < lines.length - 1 &&
      isTabsTabClose(lines[index + 1].trim())
    ) {
      report(
        messages,
        lines,
        index,
        firstNonWhitespaceIndex(line),
        'Add a blank line between fenced code blocks and </Tabs.Tab>.',
      );
    }
  }

  return messages;
}

function report(messages, lines, lineIndex, columnIndex, message) {
  messages.push({
    ruleId: 'internal-rules/mdx-tabs-spacing',
    severity: 2,
    message,
    line: lineIndex + 1,
    column: columnIndex + 1,
    endLine: lineIndex + 1,
    endColumn: lines[lineIndex].length + 1,
  });
}

function isTabsOpen(trimmedLine) {
  return /^<Tabs(?:\s|>)/u.test(trimmedLine);
}

function isTabsClose(trimmedLine) {
  return trimmedLine === '</Tabs>';
}

function isTabsTabOpen(trimmedLine) {
  return trimmedLine === '<Tabs.Tab>';
}

function isTabsTabClose(trimmedLine) {
  return trimmedLine === '</Tabs.Tab>';
}

function isCodeFence(line) {
  return /^`{3,}/u.test(line.trim());
}

function isBlank(line) {
  return line.trim() === '';
}

function firstNonWhitespaceIndex(line) {
  const match = /\S/u.exec(line);
  return match == null ? 0 : match.index;
}

export { mdxTabsSpacingProcessor };
