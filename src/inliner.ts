import * as util from "./util.ts";

const URL_REGEX = /url\(\s*(["']?)((?:\\.|[^\\)])+)\1\s*\)/gm;

export function shouldProcess(string: string): boolean {
    return string.search(URL_REGEX) !== -1;
}

export function readUrls(string: string): string[] {
    const result: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = URL_REGEX.exec(string)) !== null) {
        result.push(match[2]!);
    }
    return result.filter((url) => !util.isDataUrl(url));
}

export function urlAsRegex(urlValue: string): RegExp {
    return new RegExp(
        `url\\((["']?)(${util.escapeRegEx(urlValue)})\\1\\)`,
        "gm",
    );
}

export function inline(
    string: string,
    url: string,
    baseUrl?: string,
    get?: (url: string) => Promise<string>,
): Promise<string> {
    return Promise.resolve(url)
        .then((urlValue) =>
            baseUrl ? util.resolveUrl(urlValue, baseUrl) : urlValue,
        )
        .then(get || util.getAndEncode)
        .then((dataUrl) => {
            const pattern = urlAsRegex(url);
            return string.replace(pattern, `url($1${dataUrl}$1)`);
        });
}

export function inlineAll(
    string: string,
    baseUrl?: string,
    get?: (url: string) => Promise<string>,
): Promise<string> {
    if (!shouldProcess(string)) {
        return Promise.resolve(string);
    }

    return Promise.resolve(string)
        .then(readUrls)
        .then((urls) => {
            let done = Promise.resolve(string);
            urls.forEach((url) => {
                done = done.then((current) => inline(current, url, baseUrl, get));
            });
            return done;
        });
}
