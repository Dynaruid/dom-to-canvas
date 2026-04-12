/** Configuration for routing cross-origin image fetches through a proxy. */
export interface CorsImgConfig {
    /** Proxy endpoint that receives the original URL in `#{cors}` placeholders. */
    url?: string;
    /** HTTP method used for proxy requests. */
    method?: string;
    /** Additional headers sent to the proxy. */
    headers?: Record<string, string>;
    /** Request body sent to the proxy. */
    data?: Record<string, unknown>;
}

/** Rendering options shared by all public conversion functions. */
export interface Options {
    /** Skip nodes that return `false`. The root node is always kept. */
    filter?: (node: Node) => boolean;
    /** Mutate the cloned root before serialization. */
    onclone?: (clone: HTMLElement) => void | Promise<void>;
    /** Background color applied to the rendered output. */
    bgcolor?: string;
    /** Override the output width in CSS pixels. */
    width?: number;
    /** Override the output height in CSS pixels. */
    height?: number;
    /** Inline style overrides applied to the cloned root node. */
    style?: Record<string, string>;
    /** JPEG quality from `0` to `1`. */
    quality?: number;
    /** Canvas scale multiplier for raster outputs. */
    scale?: number;
    /** Fallback data URL used when a resource cannot be fetched. */
    imagePlaceholder?: string;
    /** Append a timestamp query param when fetching external resources. */
    cacheBust?: boolean;
    /** Send credentials when fetching external resources. */
    useCredentials?: boolean;
    /** Enable credentials only for matching URLs. */
    useCredentialsFilters?: (string | RegExp)[];
    /** Timeout for resource fetches in milliseconds. */
    httpTimeout?: number;
    /** Control how aggressively default-style caching is reused. */
    styleCaching?: "strict" | "relaxed";
    /** Copy default computed styles into the clone. */
    copyDefaultStyles?: boolean;
    /** Skip embedding `@font-face` rules into the output. */
    disableEmbedFonts?: boolean;
    /** Skip inlining `<img>` and CSS background images. */
    disableInlineImages?: boolean;
    /** Proxy configuration for cross-origin image requests. */
    corsImg?: CorsImgConfig;
    /** Hook invoked before and after each node clone is processed. */
    adjustClonedNode?: (original: Node, clone: Node, after: boolean) => void;
    /** Filter individual computed style properties while cloning styles. */
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
