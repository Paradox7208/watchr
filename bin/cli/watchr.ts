import _ from 'lodash';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { Argument, Command, Option } from 'commander';
import { Build, CommandOpts, getBuildConfig, getKeysFromJsonFile, runCapCommand } from '../utils/common';
import { buildPackage, runInit, runPlatform } from '../utils/platform';

const configChoices = await getKeysFromJsonFile('build.json');
const program = new Command('onetouch');

program
    .option('-r, --release', 'packaged for release')
    .addOption(new Option('-c, --config <config>', 'build configuration key').choices(configChoices))
    .allowExcessArguments(true)
    .allowUnknownOption(true);

newCommand('init', 'bundle web elements, initialize the native platform.', async function (_: Build, opts: CommandOpts) {
    await rm(join('platforms', opts.platform), { force: true, recursive: true });
    await runInit(opts);
    await runCapCommand('add', opts);
});

newCommand('sync', 'bundle web elements, synchronize it with the native platform.', async function (build: Build, opts: CommandOpts) {
    await runInit(opts);
    await runPlatform(build, opts);
    await runCapCommand('sync', opts);
});

newCommand('run', 'bundle web elements, synchronize it with the native platform and run on the device.', async function (build: Build, opts: CommandOpts) {
    await runInit(opts);
    await runPlatform(build, opts);
    await runCapCommand('run', opts);
});

newCommand('build', 'bundle web elements, synchronize it with the native platform and package for distribution.', async function (build: Build, opts: CommandOpts) {
    await buildPackage(build, opts);
});

await program.parseAsync(process.argv);

function newCommand(command: string, description: string, actionFn: (build: Build, opts: CommandOpts) => void | Promise<void>): Command {
    return program
        .command(command)
        .addArgument(new Argument('<platform>', 'native platform').choices(['android', 'ios']))
        .description(description)
        .action(async function (platform) {
            program
                .setOptionValue(platform, true)
                .setOptionValue('platform', platform);

            const opts: CommandOpts = program.opts();
            const build = await getBuildConfig(opts)

            await actionFn.call(this, build, opts);
        });
}