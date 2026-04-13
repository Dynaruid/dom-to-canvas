import type { CanvasRenderMode, Options } from "./src/types.ts";
import { RenderSession } from "./src/state.ts";
import { Renderer } from "./src/renderer.ts";
import { buildSvgDataUri } from "./src/pipeline.ts";
import { resolveRenderFrame } from "./src/render-size.ts";
import { removeSandbox } from "./src/sandbox.ts";

export type { CanvasRenderMode, Options, CorsImgConfig } from "./src/types.ts";
export type {
    PixelCopyResult,
    RenderSize,
} from "./src/renderer.ts";
export { Renderer } from "./src/renderer.ts";
export { RenderSession } from "./src/state.ts";

// ─── CanvasHandle ───────────────────────────────────────

export interface CanvasHandle {
    readonly canvas: HTMLCanvasElement;
    readonly node: Node;
    readonly options: Options;
    readonly isRendering: boolean;
    readonly isRunning: boolean;
    readonly frame: number;

    render(options?: Options): Promise<HTMLCanvasElement>;
    start(): void;
    stop(): void;
    update(options: Options): void;
    resize(options?: Options): void;
    dispose(): void;
}

export function getCanvas(
    node: Node,
    options: Options = {},
): CanvasHandle {
    const renderer = new Renderer();
    let currentOptions = { ...options };
    let running = false;
    let rendering = false;
    let frameCount = 0;
    let rafId = 0;
    let disposed = false;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let dirty = true;

    const handle: CanvasHandle = {
        get canvas() {
            return renderer.canvas;
        },
        get node() {
            return node;
        },
        get options() {
            return currentOptions;
        },
        get isRendering() {
            return rendering;
        },
        get isRunning() {
            return running;
        },
        get frame() {
            return frameCount;
        },

        async render(opts?: Options): Promise<HTMLCanvasElement> {
            if (disposed) throw new Error("CanvasHandle has been disposed");
            const mergedOptions = opts ? { ...currentOptions, ...opts } : currentOptions;
            rendering = true;
            try {
                const canvas = await renderer.render(node, mergedOptions);
                frameCount++;
                dirty = false;
                return canvas;
            } finally {
                rendering = false;
            }
        },

        start() {
            if (disposed) throw new Error("CanvasHandle has been disposed");
            if (running) return;
            running = true;
            dirty = true;
            startObservers();
            scheduleFrame();
        },

        stop() {
            if (!running) return;
            running = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
            stopObservers();
        },

        update(opts: Options) {
            if (disposed) throw new Error("CanvasHandle has been disposed");
            currentOptions = { ...currentOptions, ...opts };
            dirty = true;
        },

        resize(opts?: Options) {
            if (disposed) throw new Error("CanvasHandle has been disposed");
            if (opts) {
                currentOptions = { ...currentOptions, ...opts };
            }
            dirty = true;
        },

        dispose() {
            if (disposed) return;
            disposed = true;
            handle.stop();
            renderer.dispose();
            removeSandbox();
        },
    };

    return handle;

    // ── live loop helpers ─────────────────────────────────

    function scheduleFrame() {
        if (!running || disposed) return;
        rafId = requestAnimationFrame(async () => {
            if (!running || disposed) return;
            if (shouldRenderFrame() && !rendering) {
                try {
                    await handle.render();
                    dirty = false;
                } catch (error) {
                    console.error("[dom-to-canvas] render failed:", error);
                }
            }
            scheduleFrame();
        });
    }

    function startObservers() {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;

        mutationObserver = new MutationObserver(() => {
            dirty = true;
        });
        mutationObserver.observe(el, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
        });

        resizeObserver = new ResizeObserver(() => {
            dirty = true;
        });
        resizeObserver.observe(el);
    }

    function stopObservers() {
        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    }

    function shouldRenderFrame(): boolean {
        return getRenderMode(currentOptions) === "continuous" || dirty;
    }
}

// ─── One-shot Public API ────────────────────────────────

export function toSvg(
    node: Node,
    options: Options = {},
): Promise<string> {
    const session = new RenderSession(options);
    const frame = resolveRenderFrame(node, options);
    return buildSvgDataUri(node, options, frame, session).finally(() => {
        session.clearUrlCache();
        removeSandbox();
    });
}

export function toPixelData(
    node: Node,
    options?: Options,
): Promise<Uint8ClampedArray> {
    return withRenderer((renderer) =>
        renderer.toPixelData(node, options),
    );
}

export function copyPixelData(
    node: Node,
    target: Uint8Array,
    options?: Options,
): Promise<import("./src/renderer.ts").PixelCopyResult> {
    return withRenderer((renderer) =>
        renderer.copyPixelData(node, target, options),
    );
}

export function toPng(node: Node, options?: Options): Promise<string> {
    return withRenderer((renderer) => renderer.toPng(node, options));
}

export function toJpeg(node: Node, options?: Options): Promise<string> {
    return withRenderer((renderer) => renderer.toJpeg(node, options));
}

export function toBlob(node: Node, options?: Options): Promise<Blob> {
    return withRenderer((renderer) => renderer.toBlob(node, options));
}

/** @deprecated Use `getCanvas` for live rendering or `toPng`/`toJpeg` for one-shot export. */
export function toCanvas(
    node: Node,
    options?: Options,
): Promise<HTMLCanvasElement> {
    const renderer = new Renderer();
    return renderer.render(node, options).then(
        (canvas) => {
            renderer.session.clearUrlCache();
            removeSandbox();
            return canvas;
        },
        (error) => {
            renderer.dispose();
            removeSandbox();
            throw error;
        },
    );
}

// ─── Internal helpers ───────────────────────────────────

function withRenderer<T>(
    render: (renderer: Renderer) => Promise<T>,
): Promise<T> {
    const renderer = new Renderer();
    return render(renderer).then(
        (result) => {
            renderer.dispose();
            removeSandbox();
            return result;
        },
        (error) => {
            renderer.dispose();
            removeSandbox();
            throw error;
        },
    );
}

function getRenderMode(options: Options): CanvasRenderMode {
    return options.mode === "continuous" ? "continuous" : "dirty";
}
