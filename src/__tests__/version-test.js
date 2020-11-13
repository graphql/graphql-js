import { expect } from 'chai';
import { describe, it } from 'mocha';

import { version, versionInfo } from '../version';

describe('Version', () => {
  it('version', () => {
    expect(version).to.be.a('string');
    expect(version).to.match(
      /^\d+\.\d+\.\d(-(alpha|beta|rc|(experimental-[\w-]+))\.\d+)?$/,
    );
  });

  it('versionInfo', () => {
    expect(versionInfo).to.be.an('object');
    expect(versionInfo).to.have.all.keys(
      'major',
      'minor',
      'patch',
      'preReleaseTag',
    );

    const { major, minor, patch, preReleaseTag } = versionInfo;

    expect(major).to.be.a('number');
    expect(minor).to.be.a('number');
    expect(patch).to.be.a('number');

    // istanbul ignore next (Can't be verified on all versions)
    if (preReleaseTag !== null) {
      expect(preReleaseTag).to.be.a('string');
    }

    expect(
      `${major}.${minor}.${patch}` +
        // istanbul ignore next (Can't be verified on all versions)
        (preReleaseTag !== null ? '-' + preReleaseTag : ''),
    ).to.equal(version);
  });
});
