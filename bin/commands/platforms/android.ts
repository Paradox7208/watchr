import _ from 'lodash';
import { join } from 'node:path';
import { copyFile, cp, lstat, readdir, rm } from 'node:fs/promises';
import { XmlFile } from '@trapezedev/project';
import { AndroidProject } from '@trapezedev/project/dist/android/project';
import { GradleFile } from '@trapezedev/project/dist/android/gradle-file';
import { loadConfig } from '@capacitor/cli/dist/config';
import { Config } from '@capacitor/cli/dist/definitions';
import { Build, CommandOpts } from '../../utils/common';
import { generateVersionCode, generateVersionName } from '../../utils/platform';

export async function configure(android: AndroidProject, build: Build, opts: CommandOpts) {
    await android.setPackageName(build.appId);
    await android.setAppName(build.appName);
    await android.setVersionName(generateVersionName(build.version));
    await android.setVersionCode(generateVersionCode(build.version));

    const manifest = android.getAndroidManifest();
    manifest.setAttrs("manifest/application", { 'android:extractNativeLibs': 'true' });
    manifest.setAttrs("manifest/application/activity[@android:name = '.MainActivity']", {
        'android:label': '@string/app_name',
        'android:configChanges': 'orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|fontScale|density|fontWeightAdjustment',
        'android:supportsPictureInPicture': 'true'
    });

    const variables = await android.getGradleFile('variables.gradle');
    if (variables !== null) {
        await variables.parse();

        await setSdkVersion(variables, 'minSdkVersion', build.minSdkVersion);
        await setSdkVersion(variables, 'compileSdkVersion', build.compileSdkVersion);
        await setSdkVersion(variables, 'targetSdkVersion', build.targetSdkVersion);
    }

    await addOrReplaceResourceString(android, 'custom_url_scheme', `<string name="custom_url_scheme">${build.customUrlScheme}</string>`);

    const config: Config = await loadConfig();

    appPlugin(android);
    await fileOpenerPlugin(android);
    await splashscreenPlugin(android, config, opts);

    addPermissionSimple(manifest, 'android.permission.ACCESS_MEDIA_LOCATION');
    addPermissionSimple(manifest, 'android.permission.READ_EXTERNAL_STORAGE');
    addPermissionSimple(manifest, 'android.permission.MANAGE_EXTERNAL_STORAGE');
}

function addIntentFilter(manifest: XmlFile, activityPath: string, actionName: string, fragment: string) {
    if (isTargetMissing(manifest, `${activityPath}/intent-filter/action[@android:name = '${actionName}']`)) {
        injectFragment(manifest, activityPath, fragment);
    }
}

async function addOrReplaceResourceString(android: AndroidProject, name: string, fragment: string): Promise<void> {
    const strings = android.getResourceXmlFile('values/strings.xml');
    if (!strings) {
        return;
    }

    const target = `resources/string[@name = '${name}']`;

    await strings.load();

    if (isTargetMissing(strings, target)) {
        strings.injectFragment('resources', fragment);
    } else {
        strings.replaceFragment(target, fragment);
    }
}

function addPermission(manifest: XmlFile, name: string, fragment: string) {
    if (isTargetMissing(manifest, `manifest/uses-permission[@android:name = '${name}']`)) {
        injectFragment(manifest, 'manifest', fragment);
    }
}

function addPermissionSimple(manifest: XmlFile, name: string) {
    addPermission(manifest, name, `<uses-permission android:name="${name}" />`);
}

function appPlugin(android: AndroidProject) {
    addIntentFilter(
        android.getAndroidManifest(),
        "manifest/application/activity[@android:name = '.MainActivity']",
        'android.intent.action.VIEW',
        `
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="@string/custom_url_scheme" />
        </intent-filter>
        `
    );
}

async function fileOpenerPlugin(android: AndroidProject): Promise<void> {
    let filePathsXml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<paths xmlns:android="http://schemas.android.com/apk/res/android">',
        '    <root-path name="root" path="." />',
        '    <files-path name="files" path="." />',
        '    <cache-path name="cache" path="." />',
        '    <external-files-path name="external-files" path="." />',
        '    <external-cache-path name="external-cache" path="." />',
        '    <external-path name="external" path="." />',
        '</paths>'
    ];

    await android.addResource('xml', 'file_paths.xml', filePathsXml.join('\n'))
}

function getSdkVersion(variables: GradleFile, pathObject: any): Number {
    const found = variables.find(pathObject);
    if (found.length === 0) {
        return Number.NaN;
    }

    const match = variables.getSource(found[0].node).match(/\d+/g);
    return match ? parseInt(match[0], 10) : Number.NaN;
}

function hasNoElements(elements: Element[] | null): boolean {
    return ((elements && elements.length) || 0) === 0;
}

function injectFragment(manifest: XmlFile, target: string, fragment: string) {
    manifest.injectFragment(target, fragment.trim());
}

function isTargetMissing(manifest: XmlFile, target: string): boolean {
    return hasNoElements(manifest.find(target));
}

async function setSdkVersion(variables: GradleFile, name: string, version: number): Promise<void> {
    const ext = _.zipObjectDeep([`ext.${name}`], [{}]);
    const currentVersion = getSdkVersion(variables, ext);

    if (currentVersion === version) {
        return;
    }

    const replacer = _.zipObject([name], [`= ${version}`]);

    await variables.replaceProperties(ext, [replacer]);
}

async function splashscreenPlugin(android: AndroidProject, config: Config, opts: CommandOpts): Promise<void> {
    const animatedSplash = [
        '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">',
        '    <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>',
        '    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>',
        `    <item name="windowSplashScreenAnimationDuration">3000</item>`,
        '    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
        '</style>'
    ];

    const styles = android.getResourceXmlFile('values/styles.xml');

    if (styles !== null) {
        await styles.load();
        styles.replaceFragment('resources/style[@name = "AppTheme.NoActionBarLaunch"]', animatedSplash.join('\n'));
    }

    const resPath = join(config.android.platformDirAbs, android.getResourcesPath());

    readdir(resPath).then(paths => {
        paths.forEach(async filePath => {
            const fullPath = join(resPath, filePath);
            const stats = await lstat(fullPath);

            if (stats.isDirectory() && (filePath.startsWith('drawable') || filePath.startsWith('mipmap'))) {
                await rm(fullPath, { recursive: true, force: true });
            }
        });
    });

    const assetsPath = join('bin', 'assets');
    const androidAssetsPath = join(assetsPath, 'android');

    await cp(join(androidAssetsPath, 'default'), resPath, { recursive: true });
}