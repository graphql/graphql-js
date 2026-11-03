import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'node:test';
import { pathToFileURL } from 'node:url';

const packageDir = fs.realpathSync('./node_modules/graphql');
const files = fs.readdirSync(packageDir, { recursive: true });

for (const extension of ['js', 'mjs']) {
  it(`references the correct source maps in .${extension} modules`, () => {
    const mapFiles = files.filter((file) => file.endsWith(`.${extension}.map`));
    assert(mapFiles.length > 0);

    for (const mapFile of mapFiles) {
      const moduleFile = mapFile.slice(0, -4);
      const source = fs.readFileSync(path.join(packageDir, moduleFile), 'utf8');
      assert(
        source
          .trimEnd()
          .endsWith(`//# sourceMappingURL=${path.basename(mapFile)}`),
        moduleFile,
      );
    }
  });

  it(`maps .${extension} stack traces to the original TypeScript location`, async () => {
    // Load the files directly so export conditions cannot select the same format.
    const { Source, syntaxError } = await import(
      pathToFileURL(path.join(packageDir, `index.${extension}`)).href
    );
    const mapPath = path.join(packageDir, `error/syntaxError.${extension}.map`);
    const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const lines = sourceMap.sourcesContent[0].split('\n');
    const lineIndex = lines.findIndex((line) =>
      line.includes('new GraphQLError('),
    );
    assert(lineIndex >= 0);
    const column = lines[lineIndex].indexOf('new GraphQLError(') + 1;
    const sourcePath = path.resolve(
      path.dirname(mapPath),
      sourceMap.sources[0],
    );

    const error = syntaxError(new Source(''), 0, 'test');
    assert(
      error.stack
        .split('\n')[1]
        .endsWith(`(${sourcePath}:${lineIndex + 1}:${column})`),
      error.stack,
    );
  });
}
