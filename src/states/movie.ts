import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

const [movieStore, setMovieStore] = createStore<{
    movie: any | null,
    movies: any[],
    hasContinueWatching: boolean
}>({
    movie: null,
    movies: [],
    hasContinueWatching: false
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

export { setMovies };