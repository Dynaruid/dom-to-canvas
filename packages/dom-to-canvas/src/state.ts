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

export class RenderSession {
    urlCache: CacheEntry[] = [];
    options: ImplOptions;

    constructor(userOptions: Partial<ImplOptions> = {}) {
        this.options = {
            copyDefaultStyles:
                userOptions.copyDefaultStyles ?? DEFAULTS.copyDefaultStyles,
            imagePlaceholder:
                userOptions.imagePlaceholder ?? DEFAULTS.imagePlaceholder,
            cacheBust: userOptions.cacheBust ?? DEFAULTS.cacheBust,
            useCredentials:
                userOptions.useCredentials ?? DEFAULTS.useCredentials,
            useCredentialsFilters: [
                ...(userOptions.useCredentialsFilters ??
                    DEFAULTS.useCredentialsFilters),
            ],
            httpTimeout: userOptions.httpTimeout ?? DEFAULTS.httpTimeout,
            styleCaching: userOptions.styleCaching ?? DEFAULTS.styleCaching,
            corsImg: userOptions.corsImg ?? DEFAULTS.corsImg,
        };
    }

    updateOptions(userOptions: Partial<ImplOptions>): void {
        this.options.copyDefaultStyles =
            userOptions.copyDefaultStyles ?? DEFAULTS.copyDefaultStyles;
        this.options.imagePlaceholder =
            userOptions.imagePlaceholder ?? DEFAULTS.imagePlaceholder;
        this.options.cacheBust = userOptions.cacheBust ?? DEFAULTS.cacheBust;
        this.options.useCredentials =
            userOptions.useCredentials ?? DEFAULTS.useCredentials;
        this.options.useCredentialsFilters = [
            ...(userOptions.useCredentialsFilters ??
                DEFAULTS.useCredentialsFilters),
        ];
        this.options.httpTimeout = userOptions.httpTimeout ?? DEFAULTS.httpTimeout;
        this.options.styleCaching =
            userOptions.styleCaching ?? DEFAULTS.styleCaching;
        this.options.corsImg = userOptions.corsImg ?? DEFAULTS.corsImg;
    }

    clearUrlCache(): void {
        this.urlCache = [];
    }
}
