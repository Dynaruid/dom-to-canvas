import type { ImplOptions, CacheEntry } from "./types.ts";

export const OFFSCREEN: Record<string, string> = {
    position: "fixed",
    left: "-9999px",
    visibility: "hidden",
};

const DEFAULTS: ImplOptions = {
    copyDefaultStyles: true,
    imagePlaceholder: undefined,
    cacheBust: false,
    useCredentials: false,
    useCredentialsFilters: [],
    httpTimeout: 30000,
    styleCaching: "strict",
    corsImg: undefined,
};

export const state = {
    urlCache: [] as CacheEntry[],
    options: { ...DEFAULTS } as ImplOptions,
    sandbox: null as HTMLIFrameElement | null,
    removeDefaultStylesTimeoutId: null as ReturnType<typeof setTimeout> | null,
    tagNameDefaultStyles: {} as Record<string, Record<string, string>>,
};

export function copyImplOptions(options: Partial<ImplOptions>): void {
    state.options.copyDefaultStyles =
        options.copyDefaultStyles ?? DEFAULTS.copyDefaultStyles;
    state.options.imagePlaceholder =
        options.imagePlaceholder ?? DEFAULTS.imagePlaceholder;
    state.options.cacheBust = options.cacheBust ?? DEFAULTS.cacheBust;
    state.options.corsImg = options.corsImg ?? DEFAULTS.corsImg;
    state.options.useCredentials =
        options.useCredentials ?? DEFAULTS.useCredentials;
    state.options.useCredentialsFilters =
        options.useCredentialsFilters ?? [...DEFAULTS.useCredentialsFilters];
    state.options.httpTimeout = options.httpTimeout ?? DEFAULTS.httpTimeout;
    state.options.styleCaching = options.styleCaching ?? DEFAULTS.styleCaching;
}

export function clearUrlCache(): void {
    state.urlCache = [];
}
