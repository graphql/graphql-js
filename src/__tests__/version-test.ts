import { describe, it } from 'node:test';

import { expect } from 'chai';

import { version, versionInfo } from '../version.ts';

describe('Version', () => {
  it('versionInfo', () => {
    expect(versionInfo).to.be.an('object');
    expect(versionInfo).to.have.all.keys(
      'major',
      'minor',
      'patch',
      'preReleaseTag',
    );

    const { major, minor, patch, preReleaseTag } = versionInfo;
    expect(major).to.be.a('number').at.least(0);
    expect(minor).to.be.a('number').at.least(0);
    expect(patch).to.be.a('number').at.least(0);

    // Can't be verified on all versions
    /* node:coverage disable */
    switch (preReleaseTag?.split('.').length) {
      case undefined:
        break;
      case 2:
        expect(preReleaseTag).to.match(
          /^(alpha|beta|rc|experimental-[\w-]+)\.\d+/,
        );
        break;
      case 4:
        expect(preReleaseTag).to.match(
          /^(alpha|beta|rc)\.\d+.experimental-[\w-]+\.\d+/,
        );
        break;
      default:
        expect.fail('Invalid pre-release tag: ' + preReleaseTag);
    }
    /* node:coverage enable */
  });

  it('version', () => {
    expect(version).to.be.a('string');

    const { major, minor, patch, preReleaseTag } = versionInfo;
    expect(version).to.equal(
      // Can't be verified on all versions
      /* node:coverage ignore next 3 */
      preReleaseTag === null
        ? `${major}.${minor}.${patch}`
        : `${major}.${minor}.${patch}-${preReleaseTag}`,
    );
  });
});
