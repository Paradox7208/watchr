import { useNavigate, useParams } from "@solidjs/router";
import { getActiveMovie, setActiveMovie } from '~/states/movie';
import { onCleanup, onMount } from "solid-js";
import { MediaPlayer } from '@eduardoroth/media-player';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Preferences } from "@capacitor/preferences";

export default function Component() {
    const navigate = useNavigate();
    const movie = getActiveMovie();

    if (!movie?.uri) {
        return navigate('/');
    }

    const params = useParams();
    const resume = (params.resume === '1');
    const playerId: string = ('MediaPlayer_' + Date.now());
    const isNotWebPlatform: boolean = (Capacitor.getPlatform() !== 'web');

    let continueWatching: any = {},
        backButton: PluginListenerHandle | null = null;

    onCleanup(async () => {
        await backButton?.remove();
        await MediaPlayer.removeAllListeners({ playerId: playerId });
        await MediaPlayer.removeAll();
        await saveContinueWatching();

        setActiveMovie(null);
    });

    onMount(async () => {
        backButton = await App.addListener('backButton', async (e) => {
            e.canGoBack = false;
            navigate('/');
        });

        continueWatching = await Preferences.get({ key: 'ContinueWatching' }).then((p) => p.value ? JSON.parse(p.value) : {});

        if (isNotWebPlatform) {
            await ScreenOrientation.unlock();
        }

        await startMovie();
    });

    return (<div id={playerId} class="fullscreen"></div>);

    async function startMovie() {
        await MediaPlayer.create({
            playerId: playerId,
            url: movie.uri,
            web: {
                enableChromecast: false
            },
            android: {
                enablePiP: true,
                enableChromecast: false,
                fullscreenOnLandscape: true,
                openInFullscreen: true,
                stopOnTaskRemoved: false,
                enableBackgroundPlay: true,
                automaticallyEnterPiP: false
            },
            extra: {
                autoPlayWhenReady: false,
                loopOnEnd: false,
                title: movie.name,
                rate: 1,
                poster: movie.thumbnail
            },
            placement: {
                horizontalMargin: 0,
                verticalMargin: 0,
                videoOrientation: 'HORIZONTAL',
                horizontalAlignment: 'START',
                verticalAlignment: 'TOP'
            }
        });

        const { remove } = await MediaPlayer.addListener('MediaPlayer:Ready', async () => {
            await remove();

            if (resume && movie.time >= 1) {
                await MediaPlayer.setCurrentTime({ playerId: playerId, time: movie.time });
            }

            await MediaPlayer.setVisibilityBackgroundForPiP({ isVisible: false, playerId: playerId });
            await MediaPlayer.play({ playerId: playerId });
        });

        await MediaPlayer.addListener('MediaPlayer:Ended', async () => {
            if (continueWatching.hasOwnProperty(movie.normalisedName)) {
                delete continueWatching[movie.normalisedName];
            }

            navigate('/');
        });

        await MediaPlayer.addListener('MediaPlayer:TimeUpdated', async (e) => {
            continueWatching[movie.normalisedName] = e.currentTime;
        });

        await MediaPlayer.addListener('MediaPlayer:Pause', async () => {
            await saveContinueWatching();
        });
    }

    async function saveContinueWatching() {
        if (Object.keys(continueWatching).length >= 1) {
            await Preferences.set({ key: 'ContinueWatching', value: JSON.stringify(continueWatching) });
        } else {
            await Preferences.remove({ key: 'ContinueWatching' });
        }
    }
}