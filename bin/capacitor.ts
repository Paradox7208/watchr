import _ from 'lodash';
import { CapacitorConfig } from '@capacitor/cli';
import { Build, CommandOpts, getBuildConfig, parseJsonFile } from './utils/common';

export async function getConfig(opts: CommandOpts): Promise<CapacitorConfig> {
    const build = await getBuildConfig(opts);
    return await getConfigByBuild(build, opts);
}

export async function getConfigByBuild(build: Build, opts: CommandOpts): Promise<CapacitorConfig> {
    return await parseJsonFile('config.json');
}