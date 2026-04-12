import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { decodeSvgDataUrl, setupDomEnvironment } from "./support/dom.ts";

const dom = setupDomEnvironment();
const { toSvg } = await import("../index.ts");

beforeEach(() => {
    dom.reset();
});

afterAll(() => {
    dom.cleanup();
});

const TEST_OPTIONS = {
    copyDefaultStyles: false,
    disableEmbedFonts: true,
    disableInlineImages: true,
};

describe("toSvg", () => {
    test("serializes a bare text node and restores the original DOM", async () => {
        const host = document.createElement("div");
        const leading = document.createTextNode("leading ");
        const bareText = document.createTextNode("bare text");

        host.append(leading, bareText);
        document.body.append(host);

        const dataUrl = await toSvg(bareText, {
            ...TEST_OPTIONS,
            width: 120,
            height: 24,
        });
        const svg = decodeSvgDataUrl(dataUrl);

        expect(svg).toContain("bare text");
        expect(host.childNodes.length).toBe(2);
        expect(host.lastChild).toBe(bareText);
        expect(host.querySelectorAll("span").length).toBe(0);
    });

    test("applies clone-time mutations and rendering options", async () => {
        const node = document.createElement("div");
        node.textContent = "Original";
        node.style.width = "100px";
        node.style.height = "40px";
        document.body.append(node);

        const dataUrl = await toSvg(node, {
            ...TEST_OPTIONS,
            bgcolor: "#ffee00",
            width: 200,
            height: 80,
            style: {
                transform: "scale(0.5)",
            },
            onclone(clone) {
                clone.textContent = "Updated";
            },
        });
        const svg = decodeSvgDataUrl(dataUrl);

        expect(svg).toContain("Updated");
        expect(svg).toContain('width="200"');
        expect(svg).toContain('height="80"');
        expect(svg).toContain("transform: scale(0.5)");
        expect(svg).toMatch(/background-color:\s*(rgb\(255,\s*238,\s*0\)|#ffee00)/);
    });

    test("preserves form control values when cloning", async () => {
        const wrapper = document.createElement("div");
        wrapper.style.width = "160px";
        wrapper.style.height = "80px";

        const input = document.createElement("input");
        input.value = "typed input";

        const textarea = document.createElement("textarea");
        textarea.value = "typed area";

        wrapper.append(input, textarea);
        document.body.append(wrapper);

        const dataUrl = await toSvg(wrapper, TEST_OPTIONS);
        const svg = decodeSvgDataUrl(dataUrl);

        expect(svg).toContain('value="typed input"');
        expect(svg).toContain(">typed area</textarea>");
    });

    test("does not apply the filter function to the root node", async () => {
        const root = document.createElement("div");
        root.style.width = "120px";
        root.style.height = "40px";
        root.className = "omit";
        root.textContent = "Root text";

        const child = document.createElement("span");
        child.className = "omit";
        child.textContent = "Child text";
        root.append(child);
        document.body.append(root);

        const dataUrl = await toSvg(root, {
            ...TEST_OPTIONS,
            filter(node) {
                return !(node instanceof Element && node.classList.contains("omit"));
            },
        });
        const svg = decodeSvgDataUrl(dataUrl);

        expect(svg).toContain("Root text");
        expect(svg).not.toContain("Child text");
    });
});
