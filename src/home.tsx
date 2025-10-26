import { createSignal, Index, Match, onMount, Show, Suspense, Switch } from "solid-js";
import { getMovies, hasContinueWatching, setActiveMovie, setMovies, updateMovieTimestamp } from '~/states/movie';

import '@webawesome/components/card/card.js';
import '@webawesome/components/popover/popover.js';
import '@webawesome/components/button-group/button-group.js';
import '@webawesome/components/button/button.js';

import { useNavigate } from "@solidjs/router";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { FileInfo, Filesystem } from '@capacitor/filesystem';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import orderBy from 'lodash/orderBy';

const supportedVideoExtensions = ['mp4', 'flv', 'm3u8', 'webm'];
const supportedThumbnailExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const isWebPlatform = Capacitor.getPlatform() === 'web';

export default function HomeComponent() {
    const [moviesPerRow, setMoviesPerRow] = createSignal(5);
    const navigate = useNavigate();
    const movies = () => getMovies();
    const continueWatching = () => orderBy(movies(), ['lastWatched', 'name'], ['desc', 'asc']);

    const updateMoviesPerRow = async (value: number) => {
        if (!isNaN(value) && value >= 1 && value <= 10) {
            setMoviesPerRow(value);
            await Preferences.set({ key: 'MoviesPerRowValue', value: value.toString() });
        }
    }; 

    const increaseMoviesPerRow = async () => await updateMoviesPerRow(moviesPerRow() + 1);
    const decreaseMoviesPerRow = async () => await updateMoviesPerRow(moviesPerRow() - 1);

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

    onMount(async () => {
        if (!isWebPlatform) {
            await ScreenOrientation.lock({ orientation: 'portrait' });
        }

        await Preferences.get({ key: 'MoviesPerRowValue' }).then((p) => {
            if (p.value) {
                updateMoviesPerRow(Number(p.value));
            }
        });

        const titles = await fetchMovies();
        setMovies(() => titles);
    });

    return (
        <>
            <header class="header-actions">
                <wa-button appearance="plain" size="large" variant="neutral" class="header-action" onClick={decreaseMoviesPerRow}>
                    <wa-icon name="table-cells-large" class="icon"></wa-icon>
                </wa-button>
                <wa-button appearance="plain" size="large" variant="neutral" class="header-action" onClick={increaseMoviesPerRow}>
                    <wa-icon name="table-cells" class="icon"></wa-icon>
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
                                                                        <wa-icon name="xmark" class="icon"></wa-icon>
                                                                    </wa-button>
                                                                    <Switch fallback={<p class="media">{movie().name}</p>}>
                                                                        <Match when={movie().thumbnail}>
                                                                            <div class="media" onclick={[playMovie, { id: movie().id, r: 1 }]}>
                                                                                <img src={movie().thumbnail} title={movie().name} />
                                                                            </div>
                                                                        </Match>
                                                                    </Switch>
                                                                    <div class="footer-controls">
                                                                        <div class="controls">
                                                                            <wa-button appearance="accent" size="small" variant="brand" class="control" onClick={[playMovie, { id: movie().id, r: 0 }]}>
                                                                                <wa-icon slot="start" name="backward-step" class="icon"></wa-icon>
                                                                                <span>RESTART</span>
                                                                            </wa-button>
                                                                        </div>
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
                                    <div class="movies" style={{ 'grid-template-columns': ('repeat(' + moviesPerRow() + ', 1fr)') }}>
                                        <Index each={movies()}>
                                            {(movie) => (
                                                <>
                                                    <div class="movie">
                                                        <Switch fallback={<p class="media">{movie().name}</p>}>
                                                            <Match when={movie().thumbnail}>
                                                                <div class="media" onclick={[playMovie, { id: movie().id, r: 1 }]}>
                                                                    <img src={movie().thumbnail} title={movie().name} />
                                                                </div>
                                                            </Match>
                                                        </Switch>
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
            const movies = [];

            let normName: string = '',
                cw: any | null = null;

            for (var t of titles) {
                normName = t.name.toLowerCase().replaceAll(/[^a-zA-Z0-9]/g, '');
                cw = (continueWatching.hasOwnProperty(normName) ? continueWatching[normName] : null);
                movies.push({
                    id: ('movie_' + movies.length),
                    name: t.name,
                    uri: t.uri,
                    thumbnail: t.thumbnail,
                    normalisedName: normName,
                    time: cw?.time ?? 0,
                    lastWatched: cw?.lastWatched ?? 0
                });
            }

            resolve(movies);
        } finally {
            resolve([]);
        }
    });
}

function getContinueWatching(): Promise<any> {
    return Preferences.get({ key: 'ContinueWatching' }).then((p) => p.value ? JSON.parse(p.value) : {});
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

function MovieSectionComponent(props: any) {
    const navigate = useNavigate();
    const movies = () => getMovies();

    const playMovie = (data: any, e: Event) => {
        e.preventDefault();
        setActiveMovie(movies()[data.i]);
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

    return (
        <>
            <section>
                <h3>{props.title}</h3>
                <div class="movie-viewport">
                    <div class="movies" classList={{ 'continue-watching': props.isContinueWatching }}>
                        <Index each={movies()}>
                            {(movie, index) => (
                                <>
                                    <Show when={!props.isContinueWatching || (movie().time >= 1)}>
                                        <div class="movie">
                                            <Show when={props.isContinueWatching}>
                                                <wa-button appearance="plain" size="large" variant="neutral" class="remove-movie" onClick={[removeFromContinueWatching, movie()]}>
                                                    <wa-icon name="xmark" class="icon"></wa-icon>
                                                </wa-button>
                                            </Show>
                                            <Switch fallback={<p class="media">{movie().name}</p>}>
                                                <Match when={movie().thumbnail}>
                                                    <div class="media" onclick={[playMovie, { i: index, r: 1 }]}>
                                                        <img src={movie().thumbnail} title={movie().name} />
                                                        <wa-icon family="regular" name="circle-play" class="playicon"></wa-icon>
                                                    </div>
                                                </Match>
                                            </Switch>

                                            <Show when={props.isContinueWatching}>
                                                <div class="footer-controls">
                                                    <div class="controls">
                                                        <wa-button appearance="accent" size="small" variant="brand" class="control" onClick={[playMovie, { i: index, r: 0 }]}>
                                                            <wa-icon slot="start" name="backward-step" class="icon"></wa-icon>
                                                            <span>RESTART</span>
                                                        </wa-button>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>
                                    </Show>
                                </>
                            )}
                        </Index>
                    </div>
                </div>
            </section>
        </>
    );
}