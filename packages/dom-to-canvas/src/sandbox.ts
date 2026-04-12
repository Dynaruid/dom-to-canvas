import type { Options } from "./types.ts";
import { state, OFFSCREEN } from "./state.ts";
import * as util from "./util.ts";

const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;

const ASCENT_STOPPERS = [
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DETAILS", "DIALOG",
    "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE",
    "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6",
    "HEADER", "HGROUP", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "SVG", "TABLE", "UL",
    "math", "svg",
    "BODY", "HEAD", "HTML",
];

export function setStyleProperty(
    targetStyle: CSSStyleDeclaration,
    name: string,
    value: string,
    priority?: string,
): void {
    const needsPrefixing = ["background-clip"].includes(name);
    if (priority) {
        targetStyle.setProperty(name, value, priority);
        if (needsPrefixing)
            targetStyle.setProperty(`-webkit-${name}`, value, priority);
    } else {
        targetStyle.setProperty(name, value);
        if (needsPrefixing) targetStyle.setProperty(`-webkit-${name}`, value);
    }
}

export function copyUserComputedStyleFast(
    options: Options,
    sourceElement: Element,
    sourceComputedStyles: CSSStyleDeclaration,
    parentComputedStyles: CSSStyleDeclaration | null,
    targetElement: Element,
): void {
    const defaultStyle = state.options.copyDefaultStyles
        ? getDefaultStyle(options, sourceElement)
        : {};
    const targetStyle = (targetElement as HTMLElement).style;

    util.asArray(sourceComputedStyles).forEach((name) => {
        if (options.filterStyles) {
            if (!options.filterStyles(sourceElement, name)) return;
        }

        const sourceValue = sourceComputedStyles.getPropertyValue(name);
        const defaultValue = defaultStyle[name];
        const parentValue = parentComputedStyles
            ? parentComputedStyles.getPropertyValue(name)
            : undefined;

        const targetValue = targetStyle.getPropertyValue(name);
        if (targetValue) return;

        if (
            sourceValue !== defaultValue ||
            (parentComputedStyles && sourceValue !== parentValue)
        ) {
            const priority = sourceComputedStyles.getPropertyPriority(name);
            setStyleProperty(targetStyle, name, sourceValue, priority);
        }
    });
}

export function getDefaultStyle(
    options: Options,
    sourceElement: Element,
): Record<string, string> {
    const tagHierarchy = computeTagHierarchy(sourceElement);
    const tagKey = computeTagKey(options, tagHierarchy);

    if (state.tagNameDefaultStyles[tagKey]) {
        return state.tagNameDefaultStyles[tagKey]!;
    }

    const sandboxWindow = ensureSandboxWindow();
    const defaultElement = constructElementHierarchy(
        sandboxWindow.document,
        tagHierarchy,
    );
    const defaultStyle = computeStyleForDefaults(sandboxWindow, defaultElement);
    destroyElementHierarchy(defaultElement);

    state.tagNameDefaultStyles[tagKey] = defaultStyle;
    return defaultStyle;
}

function computeTagHierarchy(sourceNode: Node): string[] {
    const tagNames: string[] = [];
    let current: Node | null = sourceNode;

    while (current) {
        if (current.nodeType === ELEMENT_NODE) {
            const tagName = (current as Element).tagName;
            tagNames.push(tagName);
            if (ASCENT_STOPPERS.includes(tagName)) break;
        }
        current = current.parentNode;
    }

    return tagNames;
}

function computeTagKey(options: Options, tagHierarchy: string[]): string {
    if (options.styleCaching === "relaxed") {
        return tagHierarchy
            .filter((_, i, a) => i === 0 || i === a.length - 1)
            .join(">");
    }
    return tagHierarchy.join(">");
}

function constructElementHierarchy(
    sandboxDocument: Document,
    tagHierarchy: string[],
): Element {
    let element: Element = sandboxDocument.body;
    const tags = [...tagHierarchy];

    while (tags.length > 0) {
        const childTagName = tags.pop()!;
        const childElement = sandboxDocument.createElement(childTagName);
        element.appendChild(childElement);
        element = childElement;
    }

    element.textContent = "\u200b";
    return element;
}

function computeStyleForDefaults(
    sandboxWindow: Window,
    defaultElement: Element,
): Record<string, string> {
    const defaultStyle: Record<string, string> = {};
    const defaultComputedStyle = sandboxWindow.getComputedStyle(defaultElement);

    util.asArray(defaultComputedStyle).forEach((name) => {
        defaultStyle[name] =
            name === "width" || name === "height"
                ? "auto"
                : defaultComputedStyle.getPropertyValue(name);
    });

    return defaultStyle;
}

function destroyElementHierarchy(element: Element): void {
    let current: Element | null = element;
    while (current && current.tagName !== "BODY") {
        const parent: Element | null = current.parentElement;
        parent?.removeChild(current);
        current = parent;
    }
}

export function ensureSandboxWindow(): Window {
    if (state.sandbox) {
        return state.sandbox.contentWindow!;
    }

    const charsetToUse = document.characterSet || "UTF-8";
    const docType = document.doctype;
    const docTypeDeclaration = docType
        ? `<!DOCTYPE ${escapeHTML(docType.name)} ${escapeHTML(
            docType.publicId,
        )} ${escapeHTML(docType.systemId)}`.trim() + ">"
        : "";

    state.sandbox = document.createElement("iframe");
    state.sandbox.id = "domtoimage-sandbox-" + util.uid();
    Object.assign(state.sandbox.style, OFFSCREEN);
    document.body.appendChild(state.sandbox);

    return tryTechniques(
        state.sandbox,
        docTypeDeclaration,
        charsetToUse,
        "domtoimage-sandbox",
    );
}

function escapeHTML(unsafeText: string): string {
    if (unsafeText) {
        const div = document.createElement("div");
        div.innerText = unsafeText;
        return div.innerHTML;
    }
    return "";
}

function tryTechniques(
    sandbox: HTMLIFrameElement,
    doctype: string,
    charset: string,
    title: string,
): Window {
    try {
        sandbox.contentWindow!.document.write(
            `${doctype}<html><head><meta charset='${charset}'><title>${title}</title></head><body></body></html>`,
        );
        return sandbox.contentWindow!;
    } catch {
        // fall through to next technique
    }

    const metaCharset = document.createElement("meta");
    metaCharset.setAttribute("charset", charset);

    try {
        const sandboxDocument =
            document.implementation.createHTMLDocument(title);
        sandboxDocument.head.appendChild(metaCharset);
        const sandboxHTML = doctype + sandboxDocument.documentElement.outerHTML;
        sandbox.setAttribute("srcdoc", sandboxHTML);
        return sandbox.contentWindow!;
    } catch {
        // fall through to simplest path
    }

    sandbox.contentDocument!.head.appendChild(metaCharset);
    sandbox.contentDocument!.title = title;
    return sandbox.contentWindow!;
}

export function removeSandbox(): void {
    if (state.sandbox) {
        document.body.removeChild(state.sandbox);
        state.sandbox = null;
    }

    if (state.removeDefaultStylesTimeoutId) {
        clearTimeout(state.removeDefaultStylesTimeoutId);
    }

    state.removeDefaultStylesTimeoutId = setTimeout(() => {
        state.removeDefaultStylesTimeoutId = null;
        state.tagNameDefaultStyles = {};
    }, 20_000);
}
