const path = require('path');
const { execSync } = require('child_process');

const express = require('express');
const playwright = require('playwright');
const { expect } = require('chai');

const BUNDLERS = ['webpack'];
const BUILDS = ['prod', 'dev'];
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const PORT = 4000;

describe('bundlers', function () {
  const browsers = {};
  let server;

  this.timeout(60000);

  before(async () => {
    await Promise.all(
      BROWSERS.map(async (browserName) => {
        browsers[browserName] = await playwright[browserName].launch();
      }),
    );

    const app = express();

    app.use(express.static(__dirname));

    return new Promise((resolve) => {
      server = app.listen(PORT, resolve);
    });
  });

  after(async () => {
    await Promise.all(
      BROWSERS.map(async (browserName) => {
        await browsers[browserName].close();
      }),
    );

    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  BUNDLERS.forEach((bundler) => {
    describe(bundler, () => {
      BUILDS.forEach((build) => {
        describe(build, () => {
          before(() => {
            execSync('npm run build', {
              cwd: path.join(__dirname, bundler, build),
            });
          });

          BROWSERS.forEach((browserName) => {
            it(`works in ${browserName}`, async () => {
              const context = await browsers[browserName].newContext();
              const page = await context.newPage();
              await page.goto(
                `http://localhost:${PORT}/${bundler}/${build}/index.html`,
              );
              const mainDiv = await page.$('#main');
              const text = await mainDiv.innerText();
              expect(text).to.equal('Hello Dolly');
            });
          });
        });
      });
    });
  });
});
