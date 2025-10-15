import isNaN from 'lodash/isNaN';
import toNumber from 'lodash/toNumber';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Config } from '@capacitor/cli/dist/definitions';
import { Build, getBuildConfig, Logger, pathMissing } from '../utils/common';

if (process.env['CAPACITOR_PLATFORM_NAME'] !== 'ios') {
    process.exit(0);
}

// When iOS platform is first added, Pod Install will fail.
// Barcode Scanner plugin has a higher minimum iOS version that the core Capacitor runtime (v6.0.1).
// This platform hook updates the Podfile created by Capacitor and sets it to the higher minimum iOS version.
// This hook will run after the platform files are added, but before the plugins are validated and synced.

const capConfig: Config = JSON.parse(process.env['CAPACITOR_CONFIG']);
const podFilePath = join(process.env['CAPACITOR_ROOT_DIR'], capConfig.ios.path, 'App', 'Podfile');

if (await pathMissing(podFilePath)) {
    process.exit(0);
}

const build: Build = await getBuildConfig({
    android: false,
    ios: true,
    platform: 'ios',
    release: false
});

let podFile = (await readFile(podFilePath, { encoding: 'utf8' })).toString();

const pattern: RegExp = /(platform :ios,) '(\d+(.{1}\d+)?)'/g;
const result = pattern.exec(podFile);

// If the Podfile is formatted correctly, capture group 3 (index: 2) should contain the minimum iOS version.
// Otherwise, don't do anything if the minimum version is greater than or equal to the minimum version in our config.

if ((result.length < 3)) {
    process.exit(0);
} else {
    const makeN = (n) => {
        const num = toNumber(n);
        return isNaN(num) ? 0 : num;
    };

    if (makeN(result[2]) >= makeN(build.minIosVersion)) {
        process.exit(0);
    }
}

Logger.v('capacitor:sync:before', 'MinIosVersion', 'Setting minimum supported iOS version to ' + build.minIosVersion);
podFile = podFile.replace(/(platform :ios,) '(\d+(.{1}\d+)?)'/g, `$1 '${build.minIosVersion}'`);
await writeFile(podFilePath, podFile, { encoding: 'utf8', flag: 'w' });