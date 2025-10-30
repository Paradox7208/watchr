import { Capacitor } from '@capacitor/core';
import { Animation, StatusBar } from '@capacitor/status-bar';
import { lazy } from 'solid-js';
import { render } from 'solid-js/web';
import { Router, Route } from "@solidjs/router";
import { registerIconLibrary } from '@awesome.me/webawesome';

import '@webawesome/styles/themes/default.css';
import '@webawesome/styles/color/palettes/default.css';

function getFontIconSuffix(family: string) {
    switch (family.toLowerCase()) {
        case 'regular':
            return '-regular';
        default:
            return '';
    }
}

registerIconLibrary('default', {
    resolver: (name, family) => {
        const suffix = getFontIconSuffix(family);
        return `/icons/${name}${suffix}.svg`;
    },
});

const Home = lazy(() => import("./home"));
const VideoPlayer = lazy(() => import("./videoplayer"));

(async function () {
    if (Capacitor.getPlatform() === 'android') {
        await StatusBar.hide({ animation: Animation.None });

        const afs: any = ((window as any).AndroidFullScreen);

        if (afs && afs.isImmersiveModeSupported) {
            afs.isImmersiveModeSupported(() => afs.immersiveMode(), void 0);
        }
    }

    render(() => (
        <Router>
            <Route path="/" component={Home} />
            <Route path="/videoplayer/:resume" component={VideoPlayer} />
        </Router>
    ), document.getElementById('root')!);
})();