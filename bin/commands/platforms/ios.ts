import some from 'lodash/some';
import { join, sep } from 'node:path';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { IosBuildName, IosPbxProject, IosTargetName, MobileProject, PlistFile } from '@trapezedev/project';
import { IosProject } from '@trapezedev/project/dist/ios/project';
import { pbxSerializeString } from '@trapezedev/project/dist/util/pbx';
import { loadConfig } from '@capacitor/cli/dist/config';
import { Config } from '@capacitor/cli/dist/definitions';
import { Build, pathMissing } from '../../utils/common';
import { generateVersionCode, generateVersionName } from '../../utils/platform';

export async function configure(project: MobileProject, ios: IosProject, build: Build): Promise<void> {
    await (new IosPluginRegistration(project, ios, build)).register();
}

class IosPluginRegistration {
    project: MobileProject;
    ios: IosProject;
    build: Build;
    targetName: IosTargetName = null;
    buildName: IosBuildName = null;
    config: Config = null;

    constructor(project: MobileProject, ios: IosProject, build: Build) {
        this.project = project;
        this.ios = ios;
        this.build = build;
    }

    async register(): Promise<void> {
        await this.ios.load();

        this.config = await loadConfig();
        this.targetName = (this.ios.getAppTargetName() || 'App');

        this.ios.setBundleId(this.targetName, this.buildName, this.build.appId);
        this.updateBuildProperties(this.ios.getPbxProject());

        await this.ios.setDisplayName(this.targetName, this.buildName, this.build.appName);
        await this.ios.setVersion(this.targetName, this.buildName, generateVersionName(this.build.version));
        await this.ios.setBuild(this.targetName, this.buildName, generateVersionCode(this.build.version));

        await this.updateInfoPlist({
            ITSAppUsesNonExemptEncryption: false
        });

        await this.appPlugin();
        await this.badgePlugin();
        await this.cameraPlugin();
        await this.filesystemPlugin();
        await this.geolocationPlugin();
        await this.pushNotificationPlugin();
        await this.nfcPlugin();
        await this.splashscreenPlugin();
        await this.statusBarPlugin();
    }

    async appPlugin(): Promise<void> {
        await this.updateInfoPlist({
            CFBundleURLTypes: [{
                CFBundleURLName: '',
                CFBundleURLSchemes: [this.build.customUrlScheme]
            }]
        });
    }

    async addResourceFile(...items: string[]): Promise<void> {
        const pbx = this.ios.getPbxProject();
        const pbxGroup = pbx?.pbxGroupByName('Resources');

        if (!(pbxGroup && pbxGroup.path)) {
            pbx?.addPbxGroup([], 'Resources', 'Resources');
        }

        const groups = pbx?.hash.project.objects['PBXGroup'] ?? [];
        const emptyGroup = Object.entries(groups).find(([key, value]: [string, any]) => {
            return value.isa === 'PBXGroup' && typeof value.name === 'undefined'
        });

        const appTarget = this.ios.getAppTargetName();
        const appGroup = Object.entries(groups).find(([key, value]: [string, any]) => {
            return value.isa === 'PBXGroup' && (value.name === appTarget || value.path === appTarget);
        });

        let path, pathSplit;

        for (path of items) {
            pathSplit = path.split(sep);

            if (pathSplit[0] === appTarget && appGroup) {
                pbx?.addResourceFile(pathSplit.slice(1).join(sep), {}, appGroup?.[0]);
            } else {
                pbx?.addResourceFile(path, {}, emptyGroup?.[0]);
            }
        }
    }

    async badgePlugin(): Promise<void> {
        let pInfo = (await this.getPrivacyInfoProperty('NSPrivacyAccessedAPITypes')) as Array<any>;

        if ((pInfo?.length ?? 0) === 0) {
            pInfo = [];
        }

        if (some(pInfo, (info) => (info && info.hasOwnProperty('NSPrivacyAccessedAPIType') && info['NSPrivacyAccessedAPIType'] === 'NSPrivacyAccessedAPICategoryUserDefaults'))) {
            return;
        }

        pInfo.push({
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1']
        });

        await this.updatePrivacyInfoFile({
            NSPrivacyAccessedAPITypes: pInfo
        });
    }

    async cameraPlugin(): Promise<void> {
        await this.updateInfoPlist({
            NSCameraUsageDescription: 'In some workflows users can take photos to attach to records raised in the app. This is usually to provide evidence or for compliance reasons. The camera is also used for scanning QR codes and barcodes.',
            NSPhotoLibraryAddUsageDescription: 'In some workflows users can take photos to attach to records raised in the app. This is usually to provide evidence or for compliance reasons. The photos are stored in the Photo Library so that if the device is unable to connect to our servers, the photos can be uploaded once connectivity is restored.',
            NSPhotoLibraryUsageDescription: 'In workflows which allow photos to be attached for evidence or compliance reasons, users need to be able to attach existing photos from their library.'
        });
    }

    async filesystemPlugin(): Promise<void> {
        await this.updateInfoPlist({
            UIFileSharingEnabled: true,
            LSSupportsOpeningDocumentsInPlace: true
        });

        let pInfo = (await this.getPrivacyInfoProperty('NSPrivacyAccessedAPITypes')) as Array<any>;

        if ((pInfo?.length ?? 0) === 0) {
            pInfo = [];
        }

        if (some(pInfo, (info) => (info && info.hasOwnProperty('NSPrivacyAccessedAPIType') && info['NSPrivacyAccessedAPIType'] === 'NSPrivacyAccessedAPICategoryFileTimestamp'))) {
            return;
        }

        pInfo.push({
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1']
        });

        await this.updatePrivacyInfoFile({
            NSPrivacyAccessedAPITypes: pInfo
        });
    }

    async geolocationPlugin(): Promise<void> {
        await this.updateInfoPlist({
            NSLocationWhenInUseUsageDescription: 'On some workflows, location data is used to record where the record was created, for safety & compliance reasons. Location data is not continuously tracked or logged, it is only stamped onto a record at the time it is created. Location data may also be used for geofencing if required for a workflow.'
        });
    }

    async getPrivacyInfoFile(): Promise<PlistFile> {
        const filename = 'PrivacyInfo.xcprivacy';
        const fullPath = join(this.config.ios.platformDirAbs, 'App', filename);

        if (await pathMissing(fullPath)) {
            await writeFile(
                fullPath,
                `
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
                <plist version="1.0">
                    <dict>
                    </dict>
                </plist>
                `,
                { encoding: 'utf8', flag: 'w' }
            );
        }

        const parsed = await this.ios.getPlistFile(filename);
        await parsed.load();

        return parsed;
    }

    async getPrivacyInfoProperty(key: string): Promise<any> {
        const parsed = await this.getPrivacyInfoFile();
        const doc = parsed.getDocument() ?? {};

        return doc[key];
    }

    async pushNotificationPlugin(): Promise<void> {
        await this.ios.addEntitlements(this.targetName, this.buildName, {
            'aps-environment': 'development'
        });

        await cp(join('bin', 'assets', 'ios', 'extras'), join(this.config.ios.platformDirAbs, 'App'), { force: true, recursive: true });
        await this.addResourceFile(join('App', 'GoogleService-Info.plist'), join('App', 'sound.caf'));

        const podFilePath = join(this.config.ios.platformDirAbs, 'App', 'Podfile');
        let podFileCode = (await readFile(podFilePath, { encoding: 'utf8' })).toString().trim().split('\n');

        if (some(podFileCode, (code) => code && code.indexOf("pod 'FirebaseMessaging'") >= 0)) {
            return;
        }

        podFileCode.splice(
            podFileCode.findIndex((code) => code && code.indexOf('# Add your Pods here') >= 0),
            0,
            "  pod 'FirebaseMessaging'"
        );

        await writeFile(podFilePath, podFileCode.join('\n'), { encoding: 'utf8', flag: 'w' });
    }

    async nfcPlugin(): Promise<void> {
        await this.ios.addEntitlements(this.targetName, this.buildName, {
            'com.apple.developer.nfc.readersession.formats': ['TAG']
        });

        await this.updateInfoPlist({
            NFCReaderUsageDescription: 'NFC tags are used by some workflows for automatically recording that a record is being created at a specific location - for instance, this can be used to set up a client-specific patrol, where the user must record they have reached certain checkpoints. NFC tags are always used in some cases to swap workflows, or record the beginning of a session.'
        });
    }

    async splashscreenPlugin(): Promise<void> {
        const assetPath = join(this.config.ios.platformDirAbs, 'App', 'App', 'Assets.xcassets');

        await rm(join(assetPath, 'AppIcon.appiconset'), { recursive: true, force: true });
        await rm(join(assetPath, 'Splash.imageset'), { recursive: true, force: true });
        await cp(join('bin', 'assets', 'ios', 'default'), assetPath, { recursive: true });
    }

    async statusBarPlugin(): Promise<void> {
        await this.updateInfoPlist({
            UIViewControllerBasedStatusBarAppearance: true,
            UIStatusBarHidden: true
        });
    }

    updateBuildProperties(pbx: IosPbxProject) {
        pbx.updateBuildProperty('DEVELOPMENT_TEAM', pbxSerializeString(this.build.iosDevelopmentTeam), this.buildName, this.targetName);
        pbx.updateBuildProperty('IPHONEOS_DEPLOYMENT_TARGET', pbxSerializeString(this.build.targetIosVersion), this.buildName, this.targetName);
    }

    async updateInfoPlist(entries: any): Promise<void> {
        await this.ios.updateInfoPlist(this.targetName, this.buildName, entries, { replace: true });
    }

    async updatePrivacyInfoFile(entries: any, mergeMode?: { replace: boolean }): Promise<void> {
        const filename = 'PrivacyInfo.xcprivacy';
        const fullPath = join(this.config.ios.platformDirAbs, 'App', filename);

        if (await pathMissing(fullPath)) {
            await writeFile(
                fullPath,
                `
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
                <plist version="1.0">
                    <dict>
                    </dict>
                </plist>
                `,
                { encoding: 'utf8', flag: 'w' }
            );
        }

        const parsed = await this.ios.getPlistFile(filename);
        await parsed.load();

        parsed.update(entries, mergeMode?.replace ?? false)
        this.project.vfs.set(filename, parsed);
    }
}