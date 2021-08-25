const TypeDoc = require('typedoc');
const path = require('path');

const root = path.join(__dirname, '..');
const docsRoot = path.join(root, 'src');

const modules = [
  'error',
  'execution',
  'language',
  'subscription',
  'type',
  'utilities',
  'validation',
];

const modulePaths = modules.map((module) =>
  path.join(docsRoot, module, 'index.ts'),
);

async function main() {
  const app = new TypeDoc.Application();

  // If you want TypeDoc to load tsconfig.json / typedoc.json files
  app.options.addReader(new TypeDoc.TSConfigReader());
  app.options.addReader(new TypeDoc.TypeDocReader());

  app.bootstrap({
    tsconfig: path.join(root, 'tsconfig.json'),
    // typedoc options here
    entryPoints: [path.join(docsRoot, 'index.ts'), ...modulePaths],
  });

  const project = app.convert();

  if (project) {
    // Project may not have converted correctly
    const outputDir = 'api';

    // Rendered docs
    await app.generateDocs(project, outputDir);
    // Alternatively generate JSON output
    await app.generateJson(project, outputDir + '/documentation.json');
  }
}

main().catch(console.error);
