import _ from 'lodash';
import { join, sep } from 'node:path';
import { cp, rm, writeFile } from 'node:fs/promises';
import { CommandOpts, Logger, pathExists, PlatformConfigExtras, runCommand } from '../utils/common';

export async function run(opts: CommandOpts, extras?: PlatformConfigExtras) {
    const skipVite = (extras?.skipVite !== true);

    if (skipVite) {
        await runCommand(opts, 'vite', ['build', '-m', (opts.release ? 'production' : 'development')]);
        await rm('temp', { force: true, recursive: true });
    }

    if (opts.config) {
        const configBrandingDir = join('bin', 'assets', 'universal', opts.config) + sep;

        if (await pathExists(configBrandingDir)) {
            await cp(configBrandingDir, join('dist', 'branding'), { recursive: true });
        }
    }
}