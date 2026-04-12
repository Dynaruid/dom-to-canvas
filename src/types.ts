export interface CorsImgConfig {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: Record<string, unknown>;
}

export interface Options {
    filter?: (node: Node) => boolean;
    onclone?: (clone: HTMLElement) => void | Promise<void>;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    scale?: number;
    imagePlaceholder?: string;
    cacheBust?: boolean;
    useCredentials?: boolean;
    useCredentialsFilters?: (string | RegExp)[];
    httpTimeout?: number;
    styleCaching?: "strict" | "relaxed";
    copyDefaultStyles?: boolean;
    disableEmbedFonts?: boolean;
    disableInlineImages?: boolean;
    corsImg?: CorsImgConfig;
    adjustClonedNode?: (original: Node, clone: Node, after: boolean) => void;
    filterStyles?: (element: Element, propertyName: string) => boolean;
}

export interface ImplOptions {
    copyDefaultStyles: boolean;
    imagePlaceholder: string | undefined;
    cacheBust: boolean;
    useCredentials: boolean;
    useCredentialsFilters: (string | RegExp)[];
    httpTimeout: number;
    styleCaching: "strict" | "relaxed";
    corsImg: CorsImgConfig | undefined;
}

export interface CacheEntry {
    url: string;
    promise: Promise<string> | null;
}
