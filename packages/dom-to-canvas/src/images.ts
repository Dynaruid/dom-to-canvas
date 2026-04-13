import * as util from "./util.ts";
import * as inliner from "./inliner.ts";
import type { RenderSession } from "./state.ts";

function newImage(
    element: HTMLImageElement,
    get: (url: string) => Promise<string>,
) {
    return {
        inline(): Promise<void> {
            if (util.isDataUrl(element.src)) {
                return Promise.resolve();
            }

            return Promise.resolve(element.src)
                .then(get)
                .then(
                    (dataUrl) =>
                        new Promise<void>((resolve) => {
                            element.onload = () => resolve();
                            element.onerror = () => resolve();
                            element.src = dataUrl;
                        }),
                );
        },
    };
}

export function inlineAll(node: Node, session: RenderSession): Promise<Node> {
    if (!util.isElement(node)) {
        return Promise.resolve(node);
    }

    const get = (url: string) => util.getAndEncode(url, session);

    return inlineCSSProperty(node, get).then(() => {
        if (util.isHTMLImageElement(node)) {
            return newImage(node, get)
                .inline()
                .then(() => node);
        }
        return Promise.all(
            util.asArray(node.childNodes).map((child) => inlineAll(child, session)),
        ).then(() => node);
    });
}

function inlineCSSProperty(
    node: Element,
    get: (url: string) => Promise<string>,
): Promise<Element> {
    const properties = ["background", "background-image"];

    const tasks = properties.map((propertyName) => {
        const value = (node as HTMLElement).style.getPropertyValue(propertyName);
        const priority = (node as HTMLElement).style.getPropertyPriority(
            propertyName,
        );

        if (!value) return Promise.resolve();

        return inliner.inlineAll(value, undefined, get).then((inlinedValue) => {
            (node as HTMLElement).style.setProperty(
                propertyName,
                inlinedValue,
                priority,
            );
        });
    });

    return Promise.all(tasks).then(() => node);
}
