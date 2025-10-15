import _ from 'lodash';
import c from './colours';
import { access, constants, readFile } from 'node:fs/promises';
import { spawn, SpawnOptions } from 'child_process';

export class Logger {
    static debug(...args: any[]) {
        if (process.env.VERBOSE !== 'false') {
            console.log(c.strong().grey('[log]'), ...args);
        }
    }

    static v(platform: string, op: string, ...args: any[]) {
        this.debug(`${c.log.warn(platform)}(${c.ancillary(op)})`, ...args);
    }

    static log(...args: any[]) {
        console.log(...args);
    }

    static success(...args: any[]) {
        console.log(c.success('[success]'), ...args);
    }

    static warn(...args: any[]) {
        console.warn(...args);
    }

    static error(...args: any[]) {
        console.warn(...args);
    }
}

export type AppSettings = {
    authorisationBase: string,
    configName: string,
    debug: boolean,
    langugageResourceUrl: string,
    oneTouchConfigList: string,
    resourcesBase: string,
    themeResourceUrl: string
};

export type Build = {
    appId: string,
    appName: string,
    version: BuildVersion,
    minSdkVersion: number,
    compileSdkVersion: number,
    targetSdkVersion: number,
    gradleVersion: string,
    customUrlScheme: string,
    configKey?: string,
    minIosVersion?: string,
    targetIosVersion?: string,
    iosDevelopmentTeam?: string
};

export type BuildVersion = {
    major: number,
    minor: number,
    patch: number,
    build: number
};

export type CommandOpts = {
    android: boolean,
    config?: string,
    ios: boolean,
    platform: string,
    release: boolean,
    settings?: string,
    stdio?: string
}

export type PlatformConfigExtras = {
    skipVite: boolean
}

export async function getBuildConfig(opts: CommandOpts): Promise<Build> {
    const buildConfig: any = await parseJsonFile('build.json');
    return buildConfig;
}

export async function getKeysFromJsonFile(path: string): Promise<string[]> {
    const obj = await parseJsonFile(path);
    return Object.keys(obj).slice(1);
}

export async function parseJsonFile(path: string): Promise<any> {
    const json = await readFile(path, { encoding: 'utf8' });
    return JSON.parse(json);
}

export async function pathExists(path: string) {
    try {
        await access(path, constants.R_OK);
        return true;
    } catch (e) {
        return false;
    }
}

export async function pathMissing(path: string) {
    try {
        await access(path, constants.R_OK);
        return false;
    } catch (e) {
        return true;
    }
}

export async function runCapCommand(command: string, opts: CommandOpts) {
    let args = ['cap', command, opts.platform],
        extraArgs = [];

    for (const [key, value] of Object.entries(opts)) {
        if (value === true) {
            extraArgs.push(`--${key}`)
        } else if (!!value) {
            extraArgs.push(`--${key}`);
            extraArgs.push(`${value}`);
        }
    }

    if (extraArgs.length !== 0) {
        args.push('--');
    }

    return runCommand(opts, 'npx', args.concat(extraArgs));
}

export async function runCommand(opts: CommandOpts, command: string, args: readonly string[], options?: SpawnOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const spawnOpts: SpawnOptions = _.merge({ cwd: process.cwd(), shell: true, stdio: (opts.stdio || 'inherit') }, (options ?? {}));
        const child = spawn(command, args, spawnOpts);

        child.on('error', e => reject(e));
        child.on('close', e => (e ? reject(e) : resolve()));
        child.on('exit', e => (e ? reject(e) : resolve()));
    });
}