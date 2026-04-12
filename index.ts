import type { Options } from "./src/types.ts";
import { copyImplOptions, clearUrlCache } from "./src/state.ts";
import * as util from "./src/util.ts";
import { resolveAll as resolveAllFontFaces } from "./src/font-faces.ts";
import { inlineAll as inlineAllImages } from "./src/images.ts";
import { cloneNode } from "./src/clone.ts";
import { removeSandbox } from "./src/sandbox.ts";

export type { Options, CorsImgConfig } from "./src/types.ts";

interface Restoration {
    parent: Node | null;
    child: Node;
    wrapper: HTMLSpanElement;
}

/**
 * Serialize a DOM node into an SVG data URL.
 *
 * This is the lowest-level export and is the basis for the raster outputs.
 */
export function toSvg(node: Node, options: Options = {}): Promise<string> {
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
        .finally(cleanup);

    function ensureElement(n: Node): Node {
        if (n.nodeType === Node.ELEMENT_NODE) return n;

        const originalChild = n;
        const originalParent = n.parentNode;
        const wrappingSpan = (n.ownerDocument ?? ownerWindow.document).createElement(
            "span",
        );
        if (originalParent) {
            originalParent.replaceChild(wrappingSpan, originalChild);
        }
        wrappingSpan.append(n);
        restorations.push({
            parent: originalParent,
            child: originalChild,
            wrapper: wrappingSpan,
        });
        return wrappingSpan;
    }

    function restoreWrappers(): void {
        while (restorations.length > 0) {
            const restoration = restorations.pop()!;
            if (restoration.parent) {
                restoration.parent.replaceChild(
                    restoration.child,
                    restoration.wrapper,
                );
            } else if (restoration.child.parentNode === restoration.wrapper) {
                restoration.wrapper.removeChild(restoration.child);
            }
        }
    }

    function cleanup(): void {
        restoreWrappers();
        clearUrlCache();
        removeSandbox();
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
        const w = options.width || util.width(node);
        const h = options.height || util.height(node);

        (clone as Element).setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        const xhtml = util.escapeXhtml(
            new XMLSerializer().serializeToString(clone),
        );

        const foreignObjectSizing =
            (util.isDimensionMissing(w) ? ' width="100%"' : ` width="${w}"`) +
            (util.isDimensionMissing(h) ? ' height="100%"' : ` height="${h}"`);
        const svgSizing =
            (util.isDimensionMissing(w) ? "" : ` width="${w}"`) +
            (util.isDimensionMissing(h) ? "" : ` height="${h}"`);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg"${svgSizing}><foreignObject${foreignObjectSizing}>${xhtml}</foreignObject></svg>`;
        return `data:image/svg+xml;charset=utf-8,${svg}`;
    }
}

/** Render a DOM node and return its raw RGBA pixel data. */
export function toPixelData(
    node: Node,
    options?: Options,
): Promise<Uint8ClampedArray> {
    return draw(node, options).then((canvas) =>
        canvas
            .getContext("2d")!
            .getImageData(0, 0, util.width(node), util.height(node)).data,
    );
}

/** Render a DOM node and return a PNG data URL. */
export function toPng(node: Node, options?: Options): Promise<string> {
    return draw(node, options).then((canvas) => canvas.toDataURL());
}

/** Render a DOM node and return a JPEG data URL. */
export function toJpeg(node: Node, options?: Options): Promise<string> {
    return draw(node, options).then((canvas) =>
        canvas.toDataURL("image/jpeg", options?.quality ?? 1.0),
    );
}

/** Render a DOM node and return a PNG blob. */
export function toBlob(node: Node, options?: Options): Promise<Blob> {
    return draw(node, options).then(util.canvasToBlob);
}

/** Render a DOM node into a canvas element. */
export function toCanvas(
    node: Node,
    options?: Options,
): Promise<HTMLCanvasElement> {
    return draw(node, options);
}

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

function draw(
    domNode: Node,
    options: Options = {},
): Promise<HTMLCanvasElement> {
    return toSvg(domNode, options)
        .then(util.makeImage)
        .then((image) => {
            const scale = typeof options.scale !== "number" ? 1 : options.scale;
            const canvas = newCanvas(domNode, scale);
            const ctx = canvas.getContext("2d")!;
            (ctx as unknown as Record<string, unknown>).msImageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;
            if (image) {
                ctx.scale(scale, scale);
                ctx.drawImage(image, 0, 0);
            }
            return canvas;
        });

    function newCanvas(node: Node, scale: number): HTMLCanvasElement {
        let w = options.width || util.width(node);
        let h = options.height || util.height(node);

        if (util.isDimensionMissing(w)) {
            w = util.isDimensionMissing(h) ? 300 : h * 2.0;
        }
        if (util.isDimensionMissing(h)) {
            h = w / 2.0;
        }

        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;

        if (options.bgcolor) {
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = options.bgcolor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        return canvas;
    }
}
