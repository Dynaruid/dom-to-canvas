import * as util from "./util.ts";
import * as inliner from "./inliner.ts";

interface WebFont {
    resolve(): Promise<string>;
    src(): string;
}

export function resolveAll(): Promise<string> {
    return readAll()
        .then((webFonts) =>
            Promise.all(webFonts.map((webFont) => webFont.resolve())),
        )
        .then((cssStrings) => cssStrings.join("\n"));
}

function readAll(): Promise<WebFont[]> {
    return Promise.resolve(util.asArray(document.styleSheets))
        .then(getCssRules)
        .then(selectWebFontRules)
        .then((rules) => rules.map(newWebFont));
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

function newWebFont(webFontRule: CSSFontFaceRule): WebFont {
    return {
        resolve() {
            const baseUrl = webFontRule.parentStyleSheet?.href ?? undefined;
            return inliner.inlineAll(webFontRule.cssText, baseUrl);
        },
        src() {
            return webFontRule.style.getPropertyValue("src");
        },
    };
}
