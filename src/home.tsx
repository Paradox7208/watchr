import { createSignal, Index, Match, onCleanup, onMount, Show, Suspense, Switch } from "solid-js";
import { getDurationDisplay, getMovies, hasContinueWatching, loadDurations, setActiveMovie, setDurations, setMovies, updateMovieTimestamp } from '~/states/movie';

import '@webawesome/components/card/card.js';
import '@webawesome/components/button/button.js';
import '@webawesome/components/progress-bar/progress-bar.js';

import { useNavigate } from "@solidjs/router";
import { Preferences } from "@capacitor/preferences";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { FileInfo, Filesystem } from '@capacitor/filesystem';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { SplashScreen } from '@capacitor/splash-screen';
import orderBy from 'lodash/orderBy';

const supportedVideoExtensions = ['mp4', 'flv', 'm3u8', 'webm'];
const supportedThumbnailExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const isWebPlatform = Capacitor.getPlatform() === 'web';

var backButton: PluginListenerHandle | null = null;

export default function HomeComponent() {
    const [moviesPerRow, setMoviesPerRow] = createSignal(5);
    const [moviesAsList, setMoviesAsList] = createSignal(false);
    const navigate = useNavigate();
    const movies = () => getMovies();
    const continueWatching = () => orderBy(movies(), ['lastWatched', 'name'], ['desc', 'asc']);

    const updateMoviesPerRow = async (value: number) => {
        setMoviesAsList(false);

        if (!isNaN(value) && value >= 1 && value <= 10) {
            setMoviesPerRow(value);
            await Preferences.set({ key: 'MoviesPerRowValue', value: value.toString() });
        }
    }; 

    const increaseMoviesPerRow = async () => await updateMoviesPerRow(moviesPerRow() + 1);
    const decreaseMoviesPerRow = async () => await updateMoviesPerRow(moviesPerRow() - 1);

    const toggleMoviesAsList = async () => {
        setMoviesAsList(!moviesAsList());
        await Preferences.set({ key: 'ShowMoviesAsList', value: (moviesAsList() ? '1' : '0') });
    };

    const playMovie = (data: any, e: Event) => {
        e.preventDefault();
        setActiveMovie(movies().find((m) => m.id === data.id));
        navigate('/videoplayer/' + data.r);
    };

    const removeFromContinueWatching = async (movie: any, e: Event) => {
        e.preventDefault();
        updateMovieTimestamp(movie.id, 0);

        const cw: any = await getContinueWatching();

        if (cw.hasOwnProperty(movie.normalisedName)) {
            delete cw[movie.normalisedName];

            if (Object.keys(cw).length >= 1) {
                await Preferences.set({ key: 'ContinueWatching', value: JSON.stringify(cw) });
            } else {
                await Preferences.remove({ key: 'ContinueWatching' });
            }
        }
    };

    onCleanup(async () => {
        await backButton?.remove();
    });

    onMount(async () => {
        backButton = await App.addListener('backButton', async () => {
            await App.exitApp();
        });

        if (!isWebPlatform) {
            await ScreenOrientation.lock({ orientation: 'portrait' });
        }

        await Preferences.get({ key: 'MoviesPerRowValue' }).then((p) => {
            if (p.value) {
                updateMoviesPerRow(Number(p.value));
            }
        });

        await Preferences.get({ key: 'ShowMoviesAsList' }).then((p) => {
            setMoviesAsList(Number(p.value) === 1);
        });

        const titles = await fetchMovies();
        setMovies(() => titles);

        if (!isWebPlatform) {
            await SplashScreen.hide();
        }
    });

    return (
        <>
            <header class="header-actions">
                <wa-button appearance="plain" size="large" variant="neutral" class="header-action" onClick={toggleMoviesAsList}>
                    <wa-icon name="table-list" class="icon" style={{ 'font-size': '2em' }}></wa-icon>
                </wa-button>
                <wa-button appearance="plain" size="large" variant="neutral" class="header-action" onClick={decreaseMoviesPerRow}>
                    <wa-icon name="table-cells-large" class="icon" style={{ 'font-size': '2em' }}></wa-icon>
                </wa-button>
                <wa-button appearance="plain" size="large" variant="neutral" class="header-action" onClick={increaseMoviesPerRow}>
                    <wa-icon name="table-cells" class="icon" style={{ 'font-size': '2em' }}></wa-icon>
                </wa-button>
            </header>

            <Suspense fallback={<p>Loading movies...</p>}>
                <Switch>
                    <Match when={movies()}>
                        <main>
                            <Switch>
                                <Match when={hasContinueWatching()}>
                                    <section>
                                        <h3>Continue watching</h3>
                                        <div id="continue-watching">
                                            <div class="movies">
                                                <Index each={continueWatching()}>
                                                    {(movie) => (
                                                        <>
                                                            <Show when={movie().time >= 1}>
                                                                <div class="movie">
                                                                    <wa-button appearance="plain" size="large" variant="neutral" class="remove-movie" onClick={[removeFromContinueWatching, movie()]}>
                                                                        <wa-icon name="xmark" class="icon" style={{ 'font-size': '1em' }}></wa-icon>
                                                                    </wa-button>

                                                                    <div class="media" onclick={[playMovie, { id: movie().id, r: 1 }]}>
                                                                        <Show when={movie().thumbnail}>
                                                                            <img src={movie().thumbnail} title={movie().name} />
                                                                        </Show>
                                                                        <p>
                                                                            <span class="name">{movie().name}</span>
                                                                        </p>
                                                                        <wa-progress-bar class="progress" value={movie().progress}></wa-progress-bar>
                                                                    </div>
                                                                </div>
                                                            </Show>
                                                        </>
                                                    )}
                                                </Index>
                                            </div>
                                        </div>
                                    </section>
                                </Match>
                                <Match when={true}>
                                    <section></section>
                                </Match>
                            </Switch>
                            <section>
                                <h3>All films</h3>
                                <div id="all-movies">
                                    <div classList={{ 'movies': true, 'list': moviesAsList() }} style={{ 'grid-template-columns': moviesAsList() ? 'auto' : ('repeat(' + moviesPerRow() + ', 1fr)') }}>
                                        <Index each={movies()}>
                                            {(movie) => (
                                                <>
                                                    <div class="movie">
                                                        <div class="media" onclick={[playMovie, { id: movie().id, r: 1 }]}>
                                                            <Show when={movie().thumbnail}>
                                                                <img src={movie().thumbnail} title={movie().name} />
                                                            </Show>
                                                            <p>
                                                                <span class="name">{movie().name}</span>
                                                                <span class="timestamp">{movie().timestamp}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </Index>
                                    </div>
                                </div>
                            </section>
                        </main>
                    </Match>
                </Switch>
            </Suspense>
        </>
    );
}

function fetchMovies(): Promise<any[]> {
    return new Promise(async (resolve) => {
        try {
            const titles = await getMovieTitles();

            if (titles.length <= 0) {
                return resolve([]);
            }

            const continueWatching = await getContinueWatching();
            const durations = await loadDurations();
            const movies = [];

            let normName: string = '',
                cw: any | null = null,
                time: number = 0,
                duration: any | null = null;

            for (var t of titles) {
                normName = t.name.toLowerCase().replaceAll(/[^a-zA-Z0-9]/g, '');
                cw = (continueWatching.hasOwnProperty(normName) ? continueWatching[normName] : null);
                time = (cw?.time ?? 0);
                duration = (durations.hasOwnProperty(normName) ? durations[normName] : (await getDuration(t.uri)));

                if (duration.duration >= 0) {
                    durations[normName] = duration;
                }

                movies.push({
                    id: ('movie_' + movies.length),
                    name: t.name,
                    uri: t.uri,
                    thumbnail: t.thumbnail,
                    normalisedName: normName,
                    time: time,
                    lastWatched: cw?.lastWatched ?? 0,
                    timestamp: duration.durationDisplay,
                    progress: ((duration.duration <= 0) ? 0 : Math.trunc((time / duration.duration) * 100))
                });
            }

            await setDurations(durations);

            resolve(movies);
        } finally {
            resolve([]);
        }
    });
}

function getContinueWatching(): Promise<any> {
    return Preferences.get({ key: 'ContinueWatching' }).then((p) => p.value ? JSON.parse(p.value) : {});
}

function getDuration(uri: string): Promise<any> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.autoplay = false;

        const resolver = () => {
            const duration = (isNaN(video.duration) ? 0 : isFinite(video.duration) ? video.duration : 0);

            video.removeEventListener('abort', resolver, false);
            video.removeEventListener('error', resolver, false);
            video.removeEventListener('loadedmetadata', resolver, false);
            video.remove();

            resolve({
                duration: duration,
                durationDisplay: getDurationDisplay(duration)
            });
        };

        video.addEventListener('abort', resolver, false);
        video.addEventListener('error', resolver, false);
        video.addEventListener('loadedmetadata', resolver, false);
        video.src = Capacitor.convertFileSrc(uri);
    });
}

function getMovieTitles(): Promise<any[]> {
    return new Promise(async (resolve) => {
        try {
            if (isWebPlatform) {
                return resolve(Array.from(new Array(25)).map((_, idx) => {
                    return {
                        name: 'Jurassic Park (1993)',
                        uri: 'http://watchr.local/Jurassic%20Park%20(1993).mp4',
                        thumbnail: 'http://watchr.local/thumbnails/Jurassic%20Park%20(1993).jpg'
                    };
                }));
            }

            let folder = await Preferences.get({ key: 'FilmsFolderRoot' }).then((p) => p.value);

            if (folder === null) {
                folder = await FilePicker.pickDirectory().then((d) => d.path);
                folder = ('file:///storage/emulated/0/' + decodeURIComponent(folder!).substring('content://com.android.externalstorage.documents/tree/primary:'.length));
                await Preferences.set({ key: 'FilmsFolderRoot', value: folder });
            }

            const files = await Filesystem.readdir({ path: folder }).then((d) => d.files);
            const thumbnails = await getThumbnails(folder);
            const movies: any[] = [];

            let name: string = '',
                lowerName: string = '';

            for (var f of files) {
                if (isFileSupported(f, supportedVideoExtensions)) {
                    name = f.name.substring(0, f.name.lastIndexOf('.'));
                    lowerName = name.toLowerCase();

                    movies.push({
                        name: name,
                        uri: f.uri,
                        thumbnail: (thumbnails.find((t) => t.name === lowerName)?.webUri ?? null)
                    });
                }
            }

            resolve(orderBy(movies, ['name'], ['asc']));
        } finally {
            resolve([]);
        }
    });
}

async function getThumbnails(rootFolder: string): Promise<any[]> {
    return new Promise(async (resolve) => {
        try {
            const files = await Filesystem.readdir({ path: (rootFolder + '/thumbnails') }).then((d) => d.files);
            const thumbnails = [];

            for (var f of files) {
                if (isFileSupported(f, supportedThumbnailExtensions)) {
                    thumbnails.push({
                        name: f.name.substring(0, f.name.lastIndexOf('.')).toLowerCase(),
                        webUri: Capacitor.convertFileSrc(f.uri)
                    });
                }
            }

            resolve(thumbnails);
        } finally {
            resolve([]);
        }
    });
}

function isFileSupported(f: FileInfo, supportedExtensions: string[]): boolean {
    if (f.type !== 'file') {
        return false;
    }

    let ext = f.name.substring(f.name.lastIndexOf('.') + 1).toLowerCase();
    return supportedExtensions.includes(ext);
}