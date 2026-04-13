import type { Options } from "./types.ts";
import { OFFSCREEN } from "./state.ts";
import * as util from "./util.ts";

const ELEMENT_NODE = typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1;

let _sandbox: HTMLIFrameElement | null = null;
let _removeDefaultStylesTimeoutId: ReturnType<typeof setTimeout> | null = null;
const _tagNameDefaultStyles: Record<string, Record<string, string>> = {};

export function getSandboxNode(): Node | null {
    return _sandbox;
}

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
    const defaultStyle = options.copyDefaultStyles !== false
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

    if (_tagNameDefaultStyles[tagKey]) {
        return _tagNameDefaultStyles[tagKey]!;
    }

    const sandboxWindow = ensureSandboxWindow();
    const defaultElement = constructElementHierarchy(
        sandboxWindow.document,
        tagHierarchy,
    );
    const defaultStyle = computeStyleForDefaults(sandboxWindow, defaultElement);
    destroyElementHierarchy(defaultElement);

    _tagNameDefaultStyles[tagKey] = defaultStyle;
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
    if (_sandbox) {
        return _sandbox.contentWindow!;
    }

    const charsetToUse = document.characterSet || "UTF-8";
    const docType = document.doctype;
    const docTypeDeclaration = docType
        ? `<!DOCTYPE ${escapeHTML(docType.name)} ${escapeHTML(
            docType.publicId,
        )} ${escapeHTML(docType.systemId)}`.trim() + ">"
        : "";

    _sandbox = document.createElement("iframe");
    _sandbox.id = "domtoimage-sandbox-" + util.uid();
    Object.assign(_sandbox.style, OFFSCREEN);
    document.body.appendChild(_sandbox);

    return tryTechniques(
        _sandbox,
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
    if (_sandbox) {
        document.body.removeChild(_sandbox);
        _sandbox = null;
    }

    if (_removeDefaultStylesTimeoutId) {
        clearTimeout(_removeDefaultStylesTimeoutId);
    }

    _removeDefaultStylesTimeoutId = setTimeout(() => {
        _removeDefaultStylesTimeoutId = null;
        for (const key of Object.keys(_tagNameDefaultStyles)) {
            delete _tagNameDefaultStyles[key];
        }
    }, 20_000);
}
