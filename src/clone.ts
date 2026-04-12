import type { Options } from "./types.ts";
import { state } from "./state.ts";
import * as util from "./util.ts";
import { copyUserComputedStyleFast } from "./sandbox.ts";

export function cloneNode(
    node: Node,
    options: Options,
    parentComputedStyles: CSSStyleDeclaration | null,
    ownerWindow: Window,
): Promise<Node | undefined> {
    const filter = options.filter;

    if (
        node === (state.sandbox as Node | null) ||
        util.isHTMLScriptElement(node) ||
        util.isHTMLStyleElement(node) ||
        util.isHTMLLinkElement(node) ||
        (parentComputedStyles !== null && filter && !filter(node))
    ) {
        return Promise.resolve(undefined);
    }

    return Promise.resolve(node)
        .then(makeNodeCopy)
        .then(adjustCloneBefore)
        .then((clone) => cloneChildren(clone, getParentOfChildren(node)))
        .then(adjustCloneAfter)
        .then((clone) => processClone(clone, node));

    function makeNodeCopy(original: Node): Node | Promise<Node> {
        if (util.isHTMLCanvasElement(original)) {
            return util.makeImage(original.toDataURL()).then((img) => img!);
        }
        return original.cloneNode(false);
    }

    function adjustCloneBefore(clone: Node): Promise<Node> {
        if (options.adjustClonedNode) {
            options.adjustClonedNode(node, clone, false);
        }
        return Promise.resolve(clone);
    }

    function adjustCloneAfter(clone: Node): Promise<Node> {
        if (options.adjustClonedNode) {
            options.adjustClonedNode(node, clone, true);
        }
        return Promise.resolve(clone);
    }

    function getParentOfChildren(original: Node): Node {
        if (util.isElementHostForOpenShadowRoot(original)) {
            return original.shadowRoot;
        }
        return original;
    }

    function cloneChildren(clone: Node, original: Node): Promise<Node> {
        const originalChildren = getRenderedChildren(original);
        let done = Promise.resolve();

        if (originalChildren.length !== 0) {
            const originalComputedStyles = getComputedStyle(
                getRenderedParent(original) as Element,
            );

            util.asArray(originalChildren).forEach((originalChild) => {
                done = done.then(() =>
                    cloneNode(
                        originalChild,
                        options,
                        originalComputedStyles,
                        ownerWindow,
                    ).then((clonedChild) => {
                        if (clonedChild) clone.appendChild(clonedChild);
                    }),
                );
            });
        }

        return done.then(() => clone);

        function getRenderedParent(orig: Node): Node {
            if (util.isShadowRoot(orig)) return (orig as ShadowRoot).host;
            return orig;
        }

        function getRenderedChildren(orig: Node): NodeListOf<ChildNode> | Node[] {
            if (util.isShadowSlotElement(orig)) {
                const assignedNodes = orig.assignedNodes();
                if (assignedNodes?.length > 0) return assignedNodes;
            }
            return orig.childNodes;
        }
    }

    function processClone(clone: Node, original: Node): Promise<Node> {
        if (!util.isElement(clone) || util.isShadowSlotElement(original)) {
            return Promise.resolve(clone);
        }

        return Promise.resolve()
            .then(cloneStyle)
            .then(clonePseudoElements)
            .then(copyUserInput)
            .then(fixSvg)
            .then(fixResponsiveImages)
            .then(() => clone);

        function fixResponsiveImages(): void {
            if (util.isHTMLImageElement(clone as Element)) {
                const cloneImg = clone as HTMLImageElement;
                cloneImg.removeAttribute("loading");

                const origImg = original as HTMLImageElement;
                if (origImg.srcset || origImg.sizes) {
                    cloneImg.removeAttribute("srcset");
                    cloneImg.removeAttribute("sizes");
                    cloneImg.src = origImg.currentSrc || origImg.src;
                }
            }
        }

        function cloneStyle(): void {
            copyStyle(original as Element, clone as Element);

            function copyFont(
                source: CSSStyleDeclaration,
                target: CSSStyleDeclaration,
            ): void {
                target.font = source.font;
                target.fontFamily = source.fontFamily;
                target.fontFeatureSettings = source.fontFeatureSettings;
                target.fontKerning = source.fontKerning;
                target.fontSize = source.fontSize;
                target.fontStretch = source.fontStretch;
                target.fontStyle = source.fontStyle;
                target.fontVariant = source.fontVariant;
                target.fontVariantCaps = source.fontVariantCaps;
                target.fontVariantEastAsian = source.fontVariantEastAsian;
                target.fontVariantLigatures = source.fontVariantLigatures;
                target.fontVariantNumeric = source.fontVariantNumeric;
                (target as unknown as Record<string, unknown>).fontVariationSettings = (
                    source as unknown as Record<string, unknown>
                ).fontVariationSettings;
                target.fontWeight = source.fontWeight;
            }

            function copyStyle(
                sourceElement: Element,
                targetElement: Element,
            ): void {
                const sourceComputedStyles = getComputedStyle(sourceElement);
                if (sourceComputedStyles.cssText) {
                    (targetElement as HTMLElement).style.cssText =
                        sourceComputedStyles.cssText;
                    copyFont(
                        sourceComputedStyles,
                        (targetElement as HTMLElement).style,
                    );
                } else {
                    copyUserComputedStyleFast(
                        options,
                        sourceElement,
                        sourceComputedStyles,
                        parentComputedStyles,
                        targetElement,
                    );

                    if (parentComputedStyles === null) {
                        const ts = (targetElement as HTMLElement).style;
                        ["inset-block", "inset-block-start", "inset-block-end"].forEach(
                            (prop) => ts.removeProperty(prop),
                        );
                        ["left", "right", "top", "bottom"].forEach((prop) => {
                            if (ts.getPropertyValue(prop)) {
                                ts.setProperty(prop, "0px");
                            }
                        });
                    }
                }
            }
        }

        function clonePseudoElements(): void {
            const cloneClassName = util.uid();

            [":before", ":after"].forEach((element) => {
                clonePseudoElement(element);
            });

            function clonePseudoElement(element: string): void {
                const style = getComputedStyle(original as Element, element);
                const content = style.getPropertyValue("content");

                if (content === "" || content === "none") return;

                const currentClass =
                    (clone as Element).getAttribute("class") || "";
                (clone as Element).setAttribute(
                    "class",
                    `${currentClass} ${cloneClassName}`,
                );

                const styleElement = document.createElement("style");
                styleElement.appendChild(formatPseudoElementStyle());
                (clone as Element).appendChild(styleElement);

                function formatPseudoElementStyle(): Text {
                    const selector = `.${cloneClassName}:${element}`;
                    const cssText = style.cssText
                        ? formatCssText()
                        : formatCssProperties();
                    return document.createTextNode(`${selector}{${cssText}}`);

                    function formatCssText(): string {
                        return `${style.cssText} content: ${content};`;
                    }

                    function formatCssProperties(): string {
                        const styleText = util
                            .asArray(style)
                            .map(formatProperty)
                            .join("; ");
                        return `${styleText};`;

                        function formatProperty(name: string): string {
                            const propertyValue = style.getPropertyValue(name);
                            const propertyPriority = style.getPropertyPriority(name)
                                ? " !important"
                                : "";
                            return `${name}: ${propertyValue}${propertyPriority}`;
                        }
                    }
                }
            }
        }

        function copyUserInput(): void {
            if (util.isHTMLTextAreaElement(original as Node)) {
                (clone as HTMLTextAreaElement).innerHTML = (
                    original as HTMLTextAreaElement
                ).value;
            }
            if (util.isHTMLInputElement(original as Node)) {
                (clone as HTMLInputElement).setAttribute(
                    "value",
                    (original as HTMLInputElement).value,
                );
            }
        }

        function fixSvg(): void {
            if (util.isSVGElement(clone as Element)) {
                (clone as SVGElement).setAttribute(
                    "xmlns",
                    "http://www.w3.org/2000/svg",
                );
                if (util.isSVGRectElement(clone as Element)) {
                    ["width", "height"].forEach((attribute) => {
                        const value = (clone as SVGRectElement).getAttribute(attribute);
                        if (value) {
                            (clone as SVGRectElement).style.setProperty(attribute, value);
                        }
                    });
                }
            }
        }
    }
}
