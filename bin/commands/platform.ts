import { MobileProject } from '@trapezedev/project';
import { Build, CommandOpts } from '../utils/common';

export async function run(build: Build, opts: CommandOpts) {
    const project = new MobileProject(process.cwd(), {
        android: {
            path: 'platforms/android'
        },
        ios: {
            path: 'platforms/ios/App'
        }
    });

    // Load the project configuration
    await project.load();

    // Check if the android platform has been added
    if (opts.android && project.android) {
        const { configure } = await import('./platforms/android');
        await configure(project.android, build, opts);
    }

    // Check if the iOS platform has been added
    if (opts.ios && project.ios) {
        const { configure } = await import('./platforms/ios');
        await configure(project, project.ios, build);
    }

    // Commit the changes
    await project.commit();
}