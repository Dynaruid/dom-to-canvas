import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { setupDomEnvironment } from "./support/dom.ts";

const dom = setupDomEnvironment();
const inliner = await import("../src/inliner.ts");

beforeEach(() => {
    dom.reset();
});

afterAll(() => {
    dom.cleanup();
});

describe("inliner", () => {
    test("detects whether a CSS string contains url()", () => {
        expect(inliner.shouldProcess('url("https://example.com/file.png")')).toBe(
            true,
        );
        expect(inliner.shouldProcess('linear-gradient(#000, #fff)')).toBe(false);
    });

    test("parses URLs and skips data URLs", () => {
        expect(
            inliner.readUrls(
                'url(foo.com), url("bar.org/font.woff2"), url(data:image/png;base64,AAA)',
            ),
        ).toEqual(["foo.com", "bar.org/font.woff2"]);
    });

    test("builds a regex that matches the same quoting style", () => {
        const doubleQuoted = inliner.urlAsRegex("https://example.com/file.png");
        const doubleQuotedMatch = doubleQuoted.exec(
            'background: url("https://example.com/file.png")',
        );

        expect(doubleQuotedMatch?.slice(1, 3)).toEqual([
            '"',
            "https://example.com/file.png",
        ]);

        const singleQuoted = inliner.urlAsRegex("font.woff2");
        const singleQuotedMatch = singleQuoted.exec("src: url('font.woff2')");

        expect(singleQuotedMatch?.slice(1, 3)).toEqual(["'", "font.woff2"]);
    });

    test("inlines a single URL", async () => {
        const result = await inliner.inline(
            "background: url(image.png)",
            "image.png",
            undefined,
            async () => "data:image/png;base64,AAA",
        );

        expect(result).toBe("background: url(data:image/png;base64,AAA)");
    });

    test("resolves relative URLs against a base URL", async () => {
        const result = await inliner.inline(
            'src: url("fonts/font.woff2")',
            "fonts/font.woff2",
            "https://example.com/assets/css/main.css",
            async (url) => `data:${url}`,
        );

        expect(result).toBe(
            'src: url("data:https://example.com/assets/css/fonts/font.woff2")',
        );
    });

    test("inlines all URLs in order", async () => {
        const result = await inliner.inlineAll(
            'background: url(a.png), url("font.woff2")',
            undefined,
            async (url) => `data:${url}`,
        );

        expect(result).toBe(
            'background: url(data:a.png), url("data:font.woff2")',
        );
    });
});
