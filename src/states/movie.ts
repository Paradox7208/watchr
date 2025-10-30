import { createEffect } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { Preferences } from "@capacitor/preferences";

const [movieStore, setMovieStore] = createStore<{
    movie: any | null,
    movies: any[],
    hasContinueWatching: boolean,
    durations: any
}>({
    movie: null,
    movies: [],
    hasContinueWatching: false,
    durations: {}
});

const [movies, setMovies] = createStore(movieStore.movies);

createEffect(async () => {
    let hasCw: boolean = false;

    for (var m of movieStore.movies) {
        if (m.time >= 1) {
            hasCw = true;
            break;
        }
    }

    setMovieStore('hasContinueWatching', hasCw);
});

export const getMovies = () => movies;
export const updateMovieTimestamp = (movieId: string, time: number) => setMovies((movies) => movies.id === movieId, 'time', time);
export const setActiveMovie = (movie: any | null) => setMovieStore('movie', movie);
export const getActiveMovie = () => movieStore.movie;
export const hasContinueWatching = () => movieStore.hasContinueWatching;

export const loadDurations = async () => {
    const durations = await Preferences.get({ key: 'Durations' }).then((p) => p.value ? JSON.parse(p.value) : {});
    setMovieStore('durations', durations);
    return durations;
};

export const setDurations = async (durations: any) => {
    setMovieStore('durations', reconcile(durations));
    await Preferences.set({ key: 'Durations', value: JSON.stringify(movieStore.durations) })
};

export const setDuration = async (name: string, duration: number) => {
    const durations = unwrap(movieStore.durations);
    durations[name].duration = duration;
    durations[name].durationDisplay = getDurationDisplay(duration);

    await setDurations(durations);
};

export const getDurationDisplay = (duration: number) => {
    if (duration <= 0) {
        return `0hr 0min`;
    }

    // Duration is expected to be in seconds.
    let hours: number = Math.trunc(duration / 3600),
        minutes: number = Math.trunc((duration - (hours * 3600)) / 60);

    return `${hours}hr ${minutes}min`;
};

export { setMovies };