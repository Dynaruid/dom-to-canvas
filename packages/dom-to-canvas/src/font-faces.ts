import * as util from "./util.ts";
import * as inliner from "./inliner.ts";
import type { RenderSession } from "./state.ts";

interface WebFont {
    resolve(): Promise<string>;
    src(): string;
}

export function resolveAll(session: RenderSession): Promise<string> {
    return readAll(session)
        .then((webFonts) =>
            Promise.all(webFonts.map((webFont) => webFont.resolve())),
        )
        .then((cssStrings) => cssStrings.join("\n"));
}

function readAll(session: RenderSession): Promise<WebFont[]> {
    const get = (url: string) => util.getAndEncode(url, session);
    return Promise.resolve(util.asArray(document.styleSheets))
        .then(getCssRules)
        .then(selectWebFontRules)
        .then((rules) => rules.map((rule) => newWebFont(rule, get)));
}

function selectWebFontRules(cssRules: CSSRule[]): CSSFontFaceRule[] {
    return cssRules
        .filter(
            (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule,
        )
        .filter((rule) =>
            inliner.shouldProcess(rule.style.getPropertyValue("src")),
        );
}

function getCssRules(styleSheets: CSSStyleSheet[]): CSSRule[] {
    const cssRules: CSSRule[] = [];
    styleSheets.forEach((sheet) => {
        const sheetProto = Object.getPrototypeOf(sheet) as object;
        if (Object.prototype.hasOwnProperty.call(sheetProto, "cssRules")) {
            try {
                util
                    .asArray(sheet.cssRules || [])
                    .forEach((rule) => cssRules.push(rule));
            } catch (e) {
                console.error(
                    "domtoimage: Error while reading CSS rules from: " + sheet.href,
                    String(e),
                );
            }
        }
    });
    return cssRules;
}

function newWebFont(
    webFontRule: CSSFontFaceRule,
    get: (url: string) => Promise<string>,
): WebFont {
    return {
        resolve() {
            const baseUrl = webFontRule.parentStyleSheet?.href ?? undefined;
            return inliner.inlineAll(webFontRule.cssText, baseUrl, get);
        },
        src() {
            return webFontRule.style.getPropertyValue("src");
        },
    };
}
