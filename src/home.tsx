import { Index, Match, onMount, Show, Suspense, Switch } from "solid-js";
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

const supportedVideoExtensions = ['mp4', 'm3u8', 'webm'];
const supportedThumbnailExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const isWebPlatform = Capacitor.getPlatform() === 'web';

export default function HomeComponent() {
    const movies = () => getMovies();

    onMount(async () => {
        if (!isWebPlatform) {
            await ScreenOrientation.lock({ orientation: 'portrait' });
        }

        const titles = await fetchMovies();
        setMovies(() => titles);
    });

    return (
        <>
            <Suspense fallback={<p>Loading movies...</p>}>
                <Switch>
                    <Match when={movies()}>
                        <main>
                            <Show when={hasContinueWatching()}>
                                <MovieSectionComponent title="Continue watching" isContinueWatching={true}></MovieSectionComponent>
                            </Show>
                            <MovieSectionComponent title="All films" isContinueWatching={false}></MovieSectionComponent>
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

            let normName: string = '';

            for (var t of titles) {
                normName = t.name.toLowerCase().replaceAll(/[^a-zA-Z0-9]/g, '');
                movies.push({
                    id: ('movie_' + movies.length),
                    name: t.name,
                    uri: t.uri,
                    thumbnail: t.thumbnail,
                    normalisedName: normName,
                    time: 1 ?? (continueWatching.hasOwnProperty(normName) ? continueWatching[normName] : 0)
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
                return resolve(Array.from(new Array(5)).map((_, idx) => {
                    return {
                        name: 'Jurassic Park (1993)',
                        uri: 'http://watchr.local/Jurassic%20Park%20(1993).mp4',
                        thumbnail: 'http://watchr.local/thumbnails/Jurassic%20Park%20(1993).jpg',
                        time: 1
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

            resolve(movies);
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
                <h2>{props.title}</h2>
                <div class="movies">
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
                                                <div class="media">
                                                    <img src={movie().thumbnail} title={movie().name} />
                                                </div>
                                            </Match>
                                        </Switch>
                                        <div class="footer-controls">
                                            <wa-button-group orientation="horizontal" class="controls">
                                                <Show when={props.isContinueWatching}>
                                                    <wa-button appearance="accent" size="small" variant="brand" class="control" onClick={[playMovie, { i: index, r: 0 }]}>
                                                        <wa-icon slot="start" name="backward-step" class="icon"></wa-icon>
                                                        <span>RESTART</span>
                                                    </wa-button>
                                                </Show>
                                                <wa-button appearance="accent" size="small" variant="success" class="control" onClick={[playMovie, { i: index, r: 1 }]}>
                                                    <wa-icon slot="start" name="play" class="icon"></wa-icon>
                                                    <span>PLAY</span>
                                                </wa-button>
                                            </wa-button-group>
                                        </div>
                                    </div>
                                </Show>
                            </>
                        )}
                    </Index>
                </div>
            </section>
        </>
    );
}