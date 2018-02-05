const benchmark = require('benchmark');
const beautifyBenchmark = require('beautify-benchmark');
const sh = require('shelljs');
const chalk = require('chalk');
const pathJoin = require('path').join;

const args = process.argv.slice(2);
args[0] = args[0] || 'HEAD';
args[1] = args[1] || 'local';

console.log('Benchmarking revisions: ' + args.join(', '));

const localDistDir = './benchmark/local';
sh.rm('-rf', localDistDir);
console.log(`Building local dist: ${localDistDir}`);
sh.mkdir('-p', localDistDir);
exec(`babel src --optional runtime --copy-files --out-dir ${localDistDir}`);

const revisions = {};
for (const arg of args) {
  const distPath = buildRevisionDist(arg);
  const distRequire = (path) => reqireFromCWD(pathJoin(distPath, path));
  revisions[arg] = distRequire;
}

const suites = {};
global.suite = suite;
const testFiles = sh.ls(`${localDistDir}/**/__tests__/**/*-benchmark.js`);
for (const file of testFiles) {
  reqireFromCWD(file);
}

dummyRun();
for (const [name, measures] of Object.entries(suites)) {
  console.log(chalk.green(name) + '\n');
  benchmark.invoke(measures, 'run');
}

function reqireFromCWD(path) {
  return require(pathJoin(process.cwd(), path))
}

function dummyRun() {
  (new benchmark.Suite('dummy'))
    .add('dummy', () => { Math.pow(2, 256); })
    .run();
}

function newMeasurement(name) {
  return new benchmark.Suite(name, {
    onStart(event) {
      console.log('  ⏱️ ', event.currentTarget.name);
    },
    onCycle(event) {
      beautifyBenchmark.add(event.target);
    },
    onComplete() {
      beautifyBenchmark.log();
    },
  });
}

function suite(name, fn) {
  const measures = {};
  for (const [revision, distRequire] of Object.entries(revisions)) {
    currentRevision = revision;
    global.measure = (name, fn) => {
      measures[name] = measures[name] || newMeasurement(name);
      measures[name].add(revision, fn);
    };
    try {
      fn(distRequire);
    } catch (e) {
      console.error(e.stack);
    }
  }
  global.measure = undefined;
  suites[name] = Object.values(measures);
}

function exec(command) {
  const {code, stdout, stderr} = sh.exec(command, {silent: true});
  if (code !== 0) {
    console.error(stdout);
    console.error(stderr);
    sh.exit(code);
  }
  return stdout.trim();
}

function buildRevisionDist(revision) {
  if (revision === 'local') {
    return localDistDir;
  }

  const hash = exec(`git log -1 --format=%h "${revision}"`);
  const buildDir = './benchmark/' + hash;
  const distDir = buildDir + '/dist'

  if (sh.test('-d', buildDir)) {
    return distDir;
  }
  console.log(`Building "${revision}"(${hash}) revision: ${buildDir}`);
  sh.mkdir('-p', buildDir);
  exec(`git archive "${hash}" | tar -xC "${buildDir}"`);

  const pwd = sh.pwd();
  sh.cd(buildDir);
  exec('yarn && npm run build');
  sh.cd(pwd);
  return buildDir + '/dist';
}
