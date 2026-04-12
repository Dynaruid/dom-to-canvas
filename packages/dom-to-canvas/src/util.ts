import { state, OFFSCREEN } from "./state.ts";

const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;

let uidIndex = 0;

// ─── Window / type guards ───────────────────────────────

export function getWindow(node?: Node | null): Window & typeof globalThis {
    const ownerDocument = node?.ownerDocument;
    return (ownerDocument?.defaultView ??
        window ??
        globalThis) as Window & typeof globalThis;
}

export function isElementHostForOpenShadowRoot(
    value: Node,
): value is Element & { shadowRoot: ShadowRoot } {
    return isElement(value) && value.shadowRoot !== null;
}

export function isShadowRoot(value: Node): value is ShadowRoot {
    return value instanceof (getWindow(value) as unknown as { ShadowRoot: typeof ShadowRoot }).ShadowRoot;
}

export function isInShadowRoot(value: Node | null | undefined): boolean {
    if (value == null || value.getRootNode === undefined) return false;
    return isShadowRoot(value.getRootNode() as Node);
}

export function isElement(value: Node): value is Element {
    return value instanceof getWindow(value).Element;
}

export function isHTMLCanvasElement(
    value: Node,
): value is HTMLCanvasElement {
    return value instanceof getWindow(value).HTMLCanvasElement;
}

export function isHTMLElement(value: Node): value is HTMLElement {
    return value instanceof getWindow(value).HTMLElement;
}

export function isHTMLImageElement(
    value: Node,
): value is HTMLImageElement {
    return value instanceof getWindow(value).HTMLImageElement;
}

export function isHTMLInputElement(
    value: Node,
): value is HTMLInputElement {
    return value instanceof getWindow(value).HTMLInputElement;
}

export function isHTMLLinkElement(value: Node): value is HTMLLinkElement {
    return value instanceof getWindow(value).HTMLLinkElement;
}

export function isHTMLScriptElement(
    value: Node,
): value is HTMLScriptElement {
    return value instanceof getWindow(value).HTMLScriptElement;
}

export function isHTMLStyleElement(
    value: Node,
): value is HTMLStyleElement {
    return value instanceof getWindow(value).HTMLStyleElement;
}

export function isHTMLTextAreaElement(
    value: Node,
): value is HTMLTextAreaElement {
    return value instanceof getWindow(value).HTMLTextAreaElement;
}

export function isShadowSlotElement(value: Node): value is HTMLSlotElement {
    return (
        isInShadowRoot(value) &&
        value instanceof getWindow(value).HTMLSlotElement
    );
}

export function isSVGElement(value: Node): value is SVGElement {
    return value instanceof getWindow(value).SVGElement;
}

export function isSVGRectElement(value: Node): value is SVGRectElement {
    return value instanceof getWindow(value).SVGRectElement;
}

// ─── Data helpers ───────────────────────────────────────

export function isDataUrl(url: string): boolean {
    return url.search(/^(data:)/) !== -1;
}

export function isDimensionMissing(value: number): boolean {
    return isNaN(value) || value <= 0;
}

export function escapeRegEx(string: string): string {
    return string.replace(/([.*+?^${}()|[\]/\\])/g, "\\$1");
}

export function asArray<T>(arrayLike: ArrayLike<T>): T[] {
    const array: T[] = [];
    for (let i = 0; i < arrayLike.length; i++) {
        array.push(arrayLike[i]!);
    }
    return array;
}

export function escapeXhtml(string: string): string {
    return string
        .replace(/%/g, "%25")
        .replace(/#/g, "%23")
        .replace(/\n/g, "%0A");
}

// ─── Dimension helpers ──────────────────────────────────

export function width(node: Node): number {
    const w = px(node, "width");
    if (!isNaN(w)) return w;
    const leftBorder = px(node, "border-left-width");
    const rightBorder = px(node, "border-right-width");
    return (node as Element).scrollWidth + leftBorder + rightBorder;
}

export function height(node: Node): number {
    const h = px(node, "height");
    if (!isNaN(h)) return h;
    const topBorder = px(node, "border-top-width");
    const bottomBorder = px(node, "border-bottom-width");
    return (node as Element).scrollHeight + topBorder + bottomBorder;
}

function px(node: Node, styleProperty: string): number {
    if (node.nodeType === ELEMENT_NODE) {
        let value = getComputedStyle(node as Element).getPropertyValue(
            styleProperty,
        );
        if (value.slice(-2) === "px") {
            value = value.slice(0, -2);
            return parseFloat(value);
        }
    }
    return NaN;
}

// ─── UID ────────────────────────────────────────────────

export function uid(): string {
    return `u${fourRandomChars()}${uidIndex++}`;
}

function fourRandomChars(): string {
    return `0000${((Math.random() * Math.pow(36, 4)) << 0).toString(36)}`.slice(
        -4,
    );
}

// ─── Image / Canvas helpers ─────────────────────────────

export function makeImage(
    uri: string,
): Promise<HTMLImageElement | undefined> {
    if (uri === "data:,") {
        return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const image = new Image();

        if (state.options.useCredentials) {
            image.crossOrigin = "use-credentials";
        }

        image.onload = () => {
            document.body.removeChild(svg);
            if (window?.requestAnimationFrame) {
                window.requestAnimationFrame(() => resolve(image));
            } else {
                resolve(image);
            }
        };

        image.onerror = (error) => {
            document.body.removeChild(svg);
            reject(error);
        };

        svg.appendChild(image);
        Object.assign(svg.style, OFFSCREEN);
        image.src = uri;
        document.body.appendChild(svg);
    });
}

function asBlob(
    canvas: HTMLCanvasElement,
    type = "image/png",
    quality?: number,
): Promise<Blob> {
    return new Promise((resolve) => {
        const binaryString = atob(canvas.toDataURL(type, quality).split(",")[1]!);
        const length = binaryString.length;
        const binaryArray = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            binaryArray[i] = binaryString.charCodeAt(i);
        }
        resolve(new Blob([binaryArray], { type }));
    });
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    type = "image/png",
    quality?: number,
): Promise<Blob> {
    if (canvas.toBlob) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), type, quality);
        });
    }
    return asBlob(canvas, type, quality);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
    });
}

export function resolveUrl(url: string, baseUrl: string): string {
    const doc = document.implementation.createHTMLDocument();
    const base = doc.createElement("base");
    doc.head.appendChild(base);
    const a = doc.createElement("a");
    Object.assign(a.style, OFFSCREEN);
    doc.body.appendChild(a);
    base.href = baseUrl;
    a.href = url;
    return a.href;
}

// ─── Resource fetching ──────────────────────────────────

export function getAndEncode(url: string): Promise<string> {
    let cacheEntry = state.urlCache.find((el) => el.url === url);

    if (!cacheEntry) {
        cacheEntry = { url, promise: null };
        state.urlCache.push(cacheEntry);
    }

    if (cacheEntry.promise === null) {
        let fetchUrl = url;
        if (state.options.cacheBust) {
            fetchUrl += (/\?/.test(fetchUrl) ? "&" : "?") + new Date().getTime();
        }

        cacheEntry.promise = new Promise<string>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = state.options.httpTimeout;
            xhr.onerror = placehold;
            xhr.ontimeout = placehold;

            xhr.onloadend = () => {
                if (xhr.readyState !== XMLHttpRequest.DONE) return;

                const status = xhr.status;
                if (
                    (status === 0 && fetchUrl.toLowerCase().startsWith("file://")) ||
                    (status >= 200 && status <= 300 && xhr.response !== null)
                ) {
                    const response = xhr.response;
                    if (!(response instanceof Blob)) {
                        fail(
                            "Expected response to be a Blob, but got: " + typeof response,
                        );
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    try {
                        reader.readAsDataURL(response);
                    } catch (ex) {
                        fail("Failed to read the response as Data URL: " + String(ex));
                    }
                } else {
                    placehold();
                }
            };

            function fail(message: string): void {
                console.error(message);
                resolve("");
            }

            function placehold(): void {
                const placeholder = state.options.imagePlaceholder;
                if (placeholder) {
                    resolve(placeholder);
                } else {
                    fail(`Status:${xhr.status} while fetching resource: ${fetchUrl}`);
                }
            }

            function handleJson(data: unknown): Record<string, unknown> {
                try {
                    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
                } catch (e) {
                    fail("corsImg.data is missing or invalid:" + String(e));
                    return {};
                }
            }

            if (state.options.useCredentialsFilters.length > 0) {
                state.options.useCredentials =
                    state.options.useCredentialsFilters.some(
                        (filter) => fetchUrl.search(filter as string) >= 0,
                    );
            }

            if (state.options.useCredentials) {
                xhr.withCredentials = true;
            }

            if (
                state.options.corsImg &&
                fetchUrl.indexOf("http") === 0 &&
                fetchUrl.indexOf(window.location.origin) === -1
            ) {
                const method =
                    (state.options.corsImg.method || "GET").toUpperCase() === "POST"
                        ? "POST"
                        : "GET";
                xhr.open(
                    method,
                    (state.options.corsImg.url || "").replace("#{cors}", fetchUrl),
                    true,
                );

                let isJson = false;
                const headers = state.options.corsImg.headers || {};
                for (const [key, value] of Object.entries(headers)) {
                    if (value.includes("application/json")) isJson = true;
                    xhr.setRequestHeader(key, value);
                }

                const corsData = handleJson(state.options.corsImg.data || "");
                for (const key of Object.keys(corsData)) {
                    if (typeof corsData[key] === "string") {
                        corsData[key] = (corsData[key] as string).replace(
                            "#{cors}",
                            fetchUrl,
                        );
                    }
                }

                xhr.responseType = "blob";
                xhr.send(
                    isJson
                        ? JSON.stringify(corsData)
                        : (corsData as unknown as XMLHttpRequestBodyInit),
                );
            } else {
                xhr.open("GET", fetchUrl, true);
                xhr.responseType = "blob";
                xhr.send();
            }
        });
    }

    return cacheEntry.promise;
}
