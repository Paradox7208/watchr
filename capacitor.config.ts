import _ from 'lodash';
import { Command } from 'commander';
import { CapacitorConfig } from '@capacitor/cli';
import { getConfig } from './bin/capacitor';
import { CommandOpts } from './bin/utils/common';

async function buildConfig(): Promise<CapacitorConfig> {
    const defaultConfig: CapacitorConfig = {
        appId: 'uk.co.ronoc.watchr',
        appName: 'watchR'
    };

    const program = new Command('capacitor');
    const args = process.argv.slice();

    // When capacitor is called from command line, e.g. `npx cap` addition arguments are passed after --
    // When the build config is called directly, e.g. by OneTouch's custom command line, the arguments make up the existing command line call.
    // Check to see if we need to read the arguments, before or after, the -- entry.
    const extraArgsIdx = args.indexOf('--');
    if (extraArgsIdx >= 2) {
        args.splice(2, (extraArgsIdx - 1));
    }

    program
        .allowExcessArguments(true)
        .allowUnknownOption(true);

    await program.parseAsync(args);

    const opts: CommandOpts = program.opts();
    const overrideConfig: CapacitorConfig = await getConfig(opts);
    const config: CapacitorConfig = _.merge({}, defaultConfig, overrideConfig);

    return config;
}

export default buildConfig();