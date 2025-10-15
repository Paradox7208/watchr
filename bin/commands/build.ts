import _ from 'lodash';
import { join } from 'node:path';
import { rename, rm } from 'node:fs/promises';
import { CapacitorConfig } from '@capacitor/cli';
import { loadConfig } from '@capacitor/cli/dist/config';
import { Config } from '@capacitor/cli/dist/definitions';
import { Build, CommandOpts, Logger, pathExists, runCommand } from '../utils/common';
import { getConfigByBuild } from '../capacitor';

export async function run(build: Build, opts: CommandOpts) {
    const config: Config = await loadConfig();
    const buildConfig: CapacitorConfig = await getConfigByBuild(build, opts);
     
    if (opts.android) {
        await buildAndroidAsync(opts, config, buildConfig);
    }

    if (opts.ios) {
        await buildIosAsync(opts, config, buildConfig);
    }
}

async function buildAndroidAsync(opts: CommandOpts, config: Config, buildConfig: CapacitorConfig) {
    Logger.log('Running Gradle build');
    await runCommand(opts, 'gradlew', [(opts.release ? 'assembleRelease' : 'assembleDebug'), '--stacktrace'], { cwd: config.android.platformDirAbs });

    const buildType = (opts.release ? 'release' : 'debug');
    const outputDir = join(config.android.appDirAbs, 'build', 'outputs', 'apk', buildType);
    const outputPath = join(outputDir, `app-${buildType}.apk`);

    if (!opts.release) {
        Logger.success(`Output at: ${outputPath}`);
        return;
    }

    const options = buildConfig.android.buildOptions;

    if (!options.keystorePath || !options.keystoreAlias || !options.keystoreAliasPassword || !options.keystorePassword) {
        throw 'Missing options. Please supply all options for android signing. (Keystore Path, Keystore Password, Keystore Key Alias, Keystore Key Password)';
    }

    await rename(join(outputDir, `app-${buildType}-unsigned.apk`), outputPath);

    const signingArgs = ['sign', '--ks', options.keystorePath, '--ks-pass', ('pass:' + options.keystorePassword), '--ks-key-alias', options.keystoreAlias, '--key-pass', ('pass:' + options.keystoreAliasPassword), '--pass-encoding', 'utf-8', outputPath];

    Logger.log('Signing Release');
    await runCommand(opts, 'apksigner', signingArgs, { stdio: 'ignore' });
    Logger.success(`Output at: ${outputPath}`);
}

async function buildIosAsync(opts: CommandOpts, config: Config, buildConfig: CapacitorConfig) {
    const intermediateDirAbs: string = join(config.ios.platformDirAbs, 'build');

    if (await pathExists(intermediateDirAbs)) {
        await rm(intermediateDirAbs, { force: true, recursive: true });
    }

    Logger.log('Running XCode build');

    const scheme: string = (buildConfig.ios.scheme || config.ios.scheme);
    const schemePathAbs = join(config.ios.platformDirAbs, scheme);
    const archivePath = join(intermediateDirAbs, `${scheme}.xcarchive`);

    const configuration = (opts.release ? 'Release' : 'Debug');
    const archiveOpts = [
        'archive',
        '-workspace',
        'App.xcworkspace',
        '-scheme',
        scheme,
        '-destination',
        'generic/platform=iOS',
        '-configuration',
        configuration,
        '-archivePath',
        archivePath
    ];

    await runCommand(opts, 'xcodebuild', archiveOpts, { cwd: schemePathAbs });

    const exportOpts = [
        '-exportArchive',
        '-archivePath',
        archivePath,
        '-exportOptionsPlist',
        `ExportOptions.${configuration}.plist`,
        '-exportPath',
        intermediateDirAbs
    ];

    await runCommand(opts, 'xcodebuild', exportOpts, { cwd: schemePathAbs });

    const outputPath = join(intermediateDirAbs, `${scheme}.ipa`);

    Logger.success('Output at: ', outputPath);
}