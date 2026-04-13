import type { Options } from "./types.ts";
import type { RenderSession } from "./state.ts";
import type { ResolvedRenderFrame } from "./render-size.ts";
import * as util from "./util.ts";
import { resolveAll as resolveAllFontFaces } from "./font-faces.ts";
import { inlineAll as inlineAllImages } from "./images.ts";
import { cloneNode } from "./clone.ts";

interface Restoration {
    parent: Node;
    child: Node;
    wrapper: HTMLSpanElement;
}

export function buildSvgDataUri(
    node: Node,
    options: Options,
    frame: ResolvedRenderFrame,
    session: RenderSession,
): Promise<string> {
    const ownerWindow = util.getWindow(node);
    const restorations: Restoration[] = [];

    return Promise.resolve(node)
        .then(ensureElement)
        .then((clonee) => cloneNode(clonee, options, null, ownerWindow, session))
        .then((clone) =>
            options.disableEmbedFonts ? clone : embedFonts(clone as Node),
        )
        .then((clone) =>
            options.disableInlineImages ? clone : inlineImages(clone as Node),
        )
        .then((clone) => applyOptions(clone as Node))
        .then(makeSvgDataUri)
        .then(restoreWrappers);

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

    function embedFonts(node: Node): Promise<Node> {
        return resolveAllFontFaces(session).then((cssText) => {
            if (cssText !== "") {
                const styleNode = document.createElement("style");
                (node as Element).appendChild(styleNode);
                styleNode.appendChild(document.createTextNode(cssText));
            }
            return node;
        });
    }

    function inlineImages(node: Node): Promise<Node> {
        return inlineAllImages(node, session).then(() => node);
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
