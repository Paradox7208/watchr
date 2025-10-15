import kleur from 'kleur';

export type Colours = {
    strong: kleur.Color,
    weak: kleur.Color,
    input: kleur.Color,
    success: kleur.Color,
    failure: kleur.Color,
    ancillary: kleur.Color,
    log: LogColours
}

export type LogColours = {
    debug: kleur.Color,
    info: kleur.Color,
    warn: kleur.Color,
    error: kleur.Color
}

export const strong = kleur.bold;
export const weak = kleur.dim;
export const input = kleur.cyan;
export const success = kleur.green;
export const failure = kleur.red;
export const ancillary = kleur.cyan;

const colours: Colours = {
    strong,
    weak,
    input,
    success,
    failure,
    ancillary,
    log: {
        debug: kleur.magenta,
        info: kleur.cyan,
        warn: kleur.yellow,
        error: kleur.red,
    },
};

export default colours;