import type { CustomElements, CustomCssProperties } from '@webawesome/custom-elements-jsx.d.ts';

declare module 'solid-js' {
    namespace JSX {
        interface IntrinsicElements extends CustomElements { }
    }
    interface CSSProperties extends CustomCssProperties { }
}