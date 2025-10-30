import { useNavigate, useParams } from "@solidjs/router";
import { getActiveMovie, setDuration, setActiveMovie } from '~/states/movie';
import { onCleanup, onMount } from "solid-js";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Preferences } from "@capacitor/preferences";
import { CapacitorVideoPlayer } from '@trustcoder/capacitor-video-player';

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

    let continueWatching: any = {};

    onCleanup(async () => {
        await CapacitorVideoPlayer.removeAllListeners();
        setActiveMovie(null);
    });

    onMount(async () => {
        continueWatching = await Preferences.get({ key: 'ContinueWatching' }).then((p) => p.value ? JSON.parse(p.value) : {});

        if (!continueWatching.hasOwnProperty(movie.normalisedName)) {
            continueWatching[movie.normalisedName] = { time: 0 };
        }

        continueWatching[movie.normalisedName].lastWatched = Date.now();

        await saveContinueWatching();

        if (isNotWebPlatform) {
            await ScreenOrientation.unlock();
        }

        await startMovie();
    });

    return (<div id={playerId} class="fullscreen"></div>);

    async function startMovie() {
        await CapacitorVideoPlayer.initPlayer({
            bkmodeEnabled: true,
            chromecast: false,
            componentTag: 'div',
            displayMode: 'user_landscape',
            exitOnEnd: true,
            loopOnEnd: false,
            mode: 'fullscreen',
            pipEnabled: true,
            playerId: playerId,
            rate: 1,
            showControls: true,
            smallTitle: movie.name,
            title: movie.name,
            url: movie.uri
        });

        const { remove } = await CapacitorVideoPlayer.addListener('jeepCapVideoPlayerReady', async () => {
            await remove();

            if (resume && movie.time >= 1) {
                await CapacitorVideoPlayer.setCurrentTime({ playerId: playerId, seektime: movie.time });
            }

            const duration: number = await CapacitorVideoPlayer.getDuration({ playerId: playerId }).then((result) => result.value ? Number(result.value) : 0);

            if (!isNaN(duration) && duration >= 0) {
                await setDuration(movie.normalisedName, duration);
            }

            await CapacitorVideoPlayer.play({ playerId: playerId });
        });

        await CapacitorVideoPlayer.addListener('jeepCapVideoPlayerPause', async (e) => {
            await updateContinueWatching(Number(e.currentTime));
        });

        await CapacitorVideoPlayer.addListener('jeepCapVideoPlayerEnded', async (e) => {
            await updateContinueWatching(Number(e.currentTime));
            navigate('/');
        });

        await CapacitorVideoPlayer.addListener('jeepCapVideoPlayerExit', async (e) => {
            await updateContinueWatching(Number(e.currentTime));
            navigate('/');
        });
    }

    async function saveContinueWatching() {
        if (Object.keys(continueWatching).length >= 1) {
            await Preferences.set({ key: 'ContinueWatching', value: JSON.stringify(continueWatching) });
        } else {
            await Preferences.remove({ key: 'ContinueWatching' });
        }
    }

    async function updateContinueWatching(time: number) {
        if (isNaN(time) || time <= 0) {
            return;
        }

        continueWatching[movie.normalisedName].time = time;

        await saveContinueWatching();
    }
}