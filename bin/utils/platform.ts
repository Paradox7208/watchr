import _ from 'lodash';
import { Build, BuildVersion, CommandOpts, PlatformConfigExtras, runCapCommand } from './common';

export async function buildPackage(build: Build, opts: CommandOpts, extras?: PlatformConfigExtras): Promise<void> {
    const { run } = await import('../commands/build');

    await runInit(opts, extras);
    await runPlatform(build, opts);
    await runCapCommand('sync', opts);
    await run(build, opts);
}

export function generateVersionCode(version: BuildVersion): number {
    return ((version.major * 1000000) + (version.minor * 10000) + (version.patch * 100) + version.build);
}

export function generateVersionName(version: BuildVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
}

export async function runInit(opts: CommandOpts, extras?: PlatformConfigExtras): Promise<void> {
    const { run } = await import('../commands/init');
    await run(opts, extras);
}

export async function runPlatform(build: Build, opts: CommandOpts): Promise<void> {
    const { run } = await import('../commands/platform');
    await run(build, opts);
}