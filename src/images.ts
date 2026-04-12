import * as util from "./util.ts";
import * as inliner from "./inliner.ts";

function newImage(element: HTMLImageElement) {
    return {
        inline(get?: (url: string) => Promise<string>): Promise<void> {
            if (util.isDataUrl(element.src)) {
                return Promise.resolve();
            }

            return Promise.resolve(element.src)
                .then(get || util.getAndEncode)
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

export function inlineAll(node: Node): Promise<Node> {
    if (!util.isElement(node)) {
        return Promise.resolve(node);
    }

    return inlineCSSProperty(node).then(() => {
        if (util.isHTMLImageElement(node)) {
            return newImage(node)
                .inline()
                .then(() => node);
        }
        return Promise.all(
            util.asArray(node.childNodes).map((child) => inlineAll(child)),
        ).then(() => node);
    });
}

function inlineCSSProperty(node: Element): Promise<Element> {
    const properties = ["background", "background-image"];

    const tasks = properties.map((propertyName) => {
        const value = (node as HTMLElement).style.getPropertyValue(propertyName);
        const priority = (node as HTMLElement).style.getPropertyPriority(
            propertyName,
        );

        if (!value) return Promise.resolve();

        return inliner.inlineAll(value).then((inlinedValue) => {
            (node as HTMLElement).style.setProperty(
                propertyName,
                inlinedValue,
                priority,
            );
        });
    });

    return Promise.all(tasks).then(() => node);
}
