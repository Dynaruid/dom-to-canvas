import type { Options } from "./src/types.ts";
import { copyImplOptions, clearUrlCache } from "./src/state.ts";
import { Renderer } from "./src/renderer.ts";
import * as util from "./src/util.ts";
import { resolveAll as resolveAllFontFaces } from "./src/font-faces.ts";
import { inlineAll as inlineAllImages } from "./src/images.ts";
import { cloneNode } from "./src/clone.ts";
import {
    resolveRenderFrame,
    type ResolvedRenderFrame,
} from "./src/render-size.ts";
import { removeSandbox } from "./src/sandbox.ts";

export type { Options, CorsImgConfig } from "./src/types.ts";
export type {
    PixelCopyResult,
    RenderSize,
} from "./src/renderer.ts";
export { Renderer } from "./src/renderer.ts";

// ─── Public API ─────────────────────────────────────────

interface Restoration {
    parent: Node;
    child: Node;
    wrapper: HTMLSpanElement;
}

export function toSvg(
    node: Node,
    options: Options = {},
    frame: ResolvedRenderFrame = resolveRenderFrame(node, options),
): Promise<string> {
    const ownerWindow = util.getWindow(node);
    copyImplOptions(options);
    const restorations: Restoration[] = [];

    return Promise.resolve(node)
        .then(ensureElement)
        .then((clonee) => cloneNode(clonee, options, null, ownerWindow))
        .then((clone) =>
            options.disableEmbedFonts ? clone : embedFonts(clone as Node),
        )
        .then((clone) =>
            options.disableInlineImages ? clone : inlineImages(clone as Node),
        )
        .then((clone) => applyOptions(clone as Node))
        .then(makeSvgDataUri)
        .then(restoreWrappers)
        .then(clearCache);

    function ensureElement(n: Node): Node {
        if (n.nodeType === Node.ELEMENT_NODE) return n;

        const originalChild = n;
        const originalParent = n.parentNode!;
        const wrappingSpan = document.createElement("span");
        originalParent.replaceChild(wrappingSpan, originalChild);
        wrappingSpan.append(n);
        restorations.push({
            parent: originalParent,
            child: originalChild,
            wrapper: wrappingSpan,
        });
        return wrappingSpan;
    }

    function restoreWrappers(result: string): string {
        while (restorations.length > 0) {
            const restoration = restorations.pop()!;
            restoration.parent.replaceChild(restoration.child, restoration.wrapper);
        }
        return result;
    }

    function clearCache(result: string): string {
        clearUrlCache();
        removeSandbox();
        return result;
    }

    function applyOptions(clone: Node): Promise<Node> {
        const el = clone as HTMLElement;
        if (options.bgcolor) el.style.backgroundColor = options.bgcolor;
        if (options.width) el.style.width = `${options.width}px`;
        if (options.height) el.style.height = `${options.height}px`;

        if (options.style) {
            for (const [property, value] of Object.entries(options.style)) {
                (el.style as unknown as Record<string, string>)[property] = value;
            }
        }

        const onCloneResult =
            typeof options.onclone === "function" ? options.onclone(el) : null;
        return Promise.resolve(onCloneResult).then(() => el);
    }

    function makeSvgDataUri(clone: Node): string {
        (clone as Element).setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        const xhtml = util.escapeXhtml(
            new XMLSerializer().serializeToString(clone),
        );

        const foreignObjectSizing =
            (util.isDimensionMissing(frame.sourceWidth)
                ? ' width="100%"'
                : ` width="${frame.sourceWidth}"`) +
            (util.isDimensionMissing(frame.sourceHeight)
                ? ' height="100%"'
                : ` height="${frame.sourceHeight}"`);
        const svgSizing =
            (util.isDimensionMissing(frame.sourceWidth)
                ? ""
                : ` width="${frame.sourceWidth}"`) +
            (util.isDimensionMissing(frame.sourceHeight)
                ? ""
                : ` height="${frame.sourceHeight}"`);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg"${svgSizing}><foreignObject${foreignObjectSizing}>${xhtml}</foreignObject></svg>`;
        return `data:image/svg+xml;charset=utf-8,${svg}`;
    }
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

// ─── Internal helpers ───────────────────────────────────

function embedFonts(node: Node): Promise<Node> {
    return resolveAllFontFaces().then((cssText) => {
        if (cssText !== "") {
            const styleNode = document.createElement("style");
            (node as Element).appendChild(styleNode);
            styleNode.appendChild(document.createTextNode(cssText));
        }
        return node;
    });
}

function inlineImages(node: Node): Promise<Node> {
    return inlineAllImages(node).then(() => node);
}

function withRenderer<T>(
    render: (renderer: Renderer) => Promise<T>,
): Promise<T> {
    const renderer = new Renderer();
    return render(renderer).then(
        (result) => {
            renderer.dispose();
            return result;
        },
        (error) => {
            renderer.dispose();
            throw error;
        },
    );
}
