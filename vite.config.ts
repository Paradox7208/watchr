import { fileURLToPath, URL } from "node:url";
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import autoprefixer from 'autoprefixer';

export default defineConfig({
    build: {
        target: 'esnext'
    },
    css: {
        postcss: {
            plugins: [autoprefixer({ cascade: true, grid: true, remove: false, flexbox: true })]
        }
    },
    plugins: [
        solid()
    ],
    resolve: {
        alias: {
            '~': fileURLToPath(new URL('./src', import.meta.url)),
            '@webawesome': fileURLToPath(new URL('./node_modules/@awesome.me/webawesome/dist', import.meta.url))
        }
    }
});