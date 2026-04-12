import { JSDOM } from "jsdom";

const MISSING = Symbol("missing-global");

type ManagedKey =
    | "window"
    | "document"
    | "navigator"
    | "Node"
    | "Text"
    | "Element"
    | "HTMLElement"
    | "SVGElement"
    | "SVGRectElement"
    | "HTMLCanvasElement"
    | "HTMLImageElement"
    | "HTMLInputElement"
    | "HTMLTextAreaElement"
    | "HTMLLinkElement"
    | "HTMLStyleElement"
    | "HTMLScriptElement"
    | "HTMLSlotElement"
    | "ShadowRoot"
    | "CSSRule"
    | "CSSStyleSheet"
    | "CSSStyleDeclaration"
    | "CSSFontFaceRule"
    | "XMLSerializer"
    | "DOMParser"
    | "Blob"
    | "FileReader"
    | "XMLHttpRequest"
    | "Image"
    | "getComputedStyle"
    | "requestAnimationFrame"
    | "cancelAnimationFrame"
    | "atob"
    | "btoa";

const MANAGED_KEYS: ManagedKey[] = [
    "window",
    "document",
    "navigator",
    "Node",
    "Text",
    "Element",
    "HTMLElement",
    "SVGElement",
    "SVGRectElement",
    "HTMLCanvasElement",
    "HTMLImageElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLLinkElement",
    "HTMLStyleElement",
    "HTMLScriptElement",
    "HTMLSlotElement",
    "ShadowRoot",
    "CSSRule",
    "CSSStyleSheet",
    "CSSStyleDeclaration",
    "CSSFontFaceRule",
    "XMLSerializer",
    "DOMParser",
    "Blob",
    "FileReader",
    "XMLHttpRequest",
    "Image",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "atob",
    "btoa",
];

export interface DomEnvironment {
    cleanup(): void;
    reset(html?: string): void;
}

export function setupDomEnvironment(): DomEnvironment {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        pretendToBeVisual: true,
        url: "https://example.com/",
    });
    const { window } = dom;
    const previous = new Map<ManagedKey, unknown | symbol>();
    const baseGetComputedStyle = window.getComputedStyle.bind(window);

    window.getComputedStyle = ((element: Element) =>
        baseGetComputedStyle(element)) as typeof window.getComputedStyle;

    const globals: Record<ManagedKey, unknown> = {
        window,
        document: window.document,
        navigator: window.navigator,
        Node: window.Node,
        Text: window.Text,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        SVGElement: window.SVGElement,
        SVGRectElement:
            (window as unknown as { SVGRectElement?: typeof window.SVGElement })
                .SVGRectElement ?? window.SVGElement,
        HTMLCanvasElement: window.HTMLCanvasElement,
        HTMLImageElement: window.HTMLImageElement,
        HTMLInputElement: window.HTMLInputElement,
        HTMLTextAreaElement: window.HTMLTextAreaElement,
        HTMLLinkElement: window.HTMLLinkElement,
        HTMLStyleElement: window.HTMLStyleElement,
        HTMLScriptElement: window.HTMLScriptElement,
        HTMLSlotElement: window.HTMLSlotElement,
        ShadowRoot: window.ShadowRoot,
        CSSRule: window.CSSRule,
        CSSStyleSheet: window.CSSStyleSheet,
        CSSStyleDeclaration: window.CSSStyleDeclaration,
        CSSFontFaceRule:
            (window as unknown as { CSSFontFaceRule?: typeof window.CSSRule })
                .CSSFontFaceRule ?? window.CSSRule,
        XMLSerializer: window.XMLSerializer,
        DOMParser: window.DOMParser,
        Blob: window.Blob,
        FileReader: window.FileReader,
        XMLHttpRequest: window.XMLHttpRequest,
        Image: window.Image,
        getComputedStyle: window.getComputedStyle.bind(window),
        requestAnimationFrame: window.requestAnimationFrame.bind(window),
        cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
        atob: window.atob.bind(window),
        btoa: window.btoa.bind(window),
    };

    for (const key of MANAGED_KEYS) {
        previous.set(
            key,
            key in globalThis
                ? (globalThis as Record<string, unknown>)[key]
                : MISSING,
        );

        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value: globals[key],
        });
    }

    return {
        cleanup() {
            for (const key of MANAGED_KEYS) {
                const value = previous.get(key);
                if (value === MISSING) {
                    delete (globalThis as Record<string, unknown>)[key];
                } else {
                    Object.defineProperty(globalThis, key, {
                        configurable: true,
                        writable: true,
                        value,
                    });
                }
            }

            dom.window.close();
        },

        reset(html = "") {
            window.document.head.innerHTML = "";
            window.document.body.innerHTML = html;
        },
    };
}

export function decodeSvgDataUrl(dataUrl: string): string {
    const prefix = "data:image/svg+xml;charset=utf-8,";
    if (!dataUrl.startsWith(prefix)) {
        throw new Error(`Unexpected SVG data URL: ${dataUrl.slice(0, 32)}`);
    }

    return decodeURIComponent(dataUrl.slice(prefix.length));
}
