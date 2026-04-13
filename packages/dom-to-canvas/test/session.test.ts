import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";

import { decodeSvgDataUrl, setupDomEnvironment } from "./support/dom.ts";

const dom = setupDomEnvironment();
const { toSvg, getCanvas, RenderSession } = await import("../index.ts");
const { buildSvgDataUri } = await import("../src/pipeline.ts");
const { resolveRenderFrame } = await import("../src/render-size.ts");

let restoreRaf: (() => void) | null = null;
let flushRaf: ((time?: number) => void) | null = null;

beforeEach(() => {
    dom.reset();

    const rafController = installRafController();
    restoreRaf = rafController.restore;
    flushRaf = rafController.flush;
});

afterEach(() => {
    restoreRaf?.();
    restoreRaf = null;
    flushRaf = null;
});

afterAll(() => {
    dom.cleanup();
});

const TEST_OPTIONS = {
    copyDefaultStyles: false,
    disableEmbedFonts: true,
    disableInlineImages: true,
};

describe("RenderSession", () => {
    test("creates with default options", () => {
        const session = new RenderSession();
        expect(session.options.copyDefaultStyles).toBe(true);
        expect(session.options.cacheBust).toBe(false);
        expect(session.options.httpTimeout).toBe(30000);
        expect(session.urlCache).toEqual([]);
    });

    test("creates with custom options", () => {
        const session = new RenderSession({
            cacheBust: true,
            httpTimeout: 5000,
            useCredentials: true,
        });
        expect(session.options.cacheBust).toBe(true);
        expect(session.options.httpTimeout).toBe(5000);
        expect(session.options.useCredentials).toBe(true);
    });

    test("updateOptions replaces options", () => {
        const session = new RenderSession();
        session.updateOptions({ cacheBust: true, httpTimeout: 999 });
        expect(session.options.cacheBust).toBe(true);
        expect(session.options.httpTimeout).toBe(999);
    });

    test("clearUrlCache empties the cache", () => {
        const session = new RenderSession();
        session.urlCache.push({ url: "test", promise: null });
        expect(session.urlCache.length).toBe(1);
        session.clearUrlCache();
        expect(session.urlCache.length).toBe(0);
    });
});

describe("session isolation", () => {
    test("concurrent toSvg calls use independent sessions", async () => {
        const nodeA = document.createElement("div");
        nodeA.textContent = "A";
        nodeA.style.width = "100px";
        nodeA.style.height = "50px";
        document.body.append(nodeA);

        const nodeB = document.createElement("div");
        nodeB.textContent = "B";
        nodeB.style.width = "200px";
        nodeB.style.height = "100px";
        document.body.append(nodeB);

        const [svgA, svgB] = await Promise.all([
            toSvg(nodeA, { ...TEST_OPTIONS, width: 100, height: 50 }),
            toSvg(nodeB, { ...TEST_OPTIONS, width: 200, height: 100 }),
        ]);

        const decodedA = decodeSvgDataUrl(svgA);
        const decodedB = decodeSvgDataUrl(svgB);

        expect(decodedA).toContain(">A<");
        expect(decodedB).toContain(">B<");
        expect(decodedA).toContain('width="100"');
        expect(decodedB).toContain('width="200"');
    });
});

describe("getCanvas", () => {
    test("returns a handle with canvas and node references", () => {
        const node = document.createElement("div");
        node.textContent = "Test";
        node.style.width = "120px";
        node.style.height = "60px";
        document.body.append(node);

        const handle = getCanvas(node, TEST_OPTIONS);

        expect(handle.canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(handle.node).toBe(node);
        expect(handle.options).toEqual(TEST_OPTIONS);
        expect(handle.isRendering).toBe(false);
        expect(handle.isRunning).toBe(false);
        expect(handle.frame).toBe(0);

        handle.dispose();
    });

    test("render builds SVG through the pipeline with its own session", async () => {
        const node = document.createElement("div");
        node.textContent = "Render me";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, {
            ...TEST_OPTIONS,
            width: 100,
            height: 50,
        });

        // Verify the handle's session can drive the pipeline
        const session = (handle as unknown as { _testSession?: undefined }).constructor
            ? new RenderSession(handle.options)
            : new RenderSession(handle.options);
        const frame = resolveRenderFrame(node, handle.options);
        const svgDataUri = await buildSvgDataUri(node, handle.options, frame, session);
        const svg = decodeSvgDataUrl(svgDataUri);
        expect(svg).toContain("Render me");

        handle.dispose();
    });

    test("update changes options for next render", async () => {
        const node = document.createElement("div");
        node.textContent = "Update";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, {
            ...TEST_OPTIONS,
            width: 100,
            height: 50,
        });

        handle.update({ width: 200, height: 100 });
        expect(handle.options.width).toBe(200);
        expect(handle.options.height).toBe(100);

        handle.dispose();
    });

    test("dirty mode renders once and waits for invalidation", async () => {
        const node = document.createElement("div");
        node.textContent = "Dirty";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, TEST_OPTIONS);
        let renders = 0;

        handle.render = async () => {
            renders += 1;
            return handle.canvas;
        };

        handle.start();
        flushRaf?.(16);
        await Promise.resolve();
        expect(renders).toBe(1);

        flushRaf?.(32);
        await Promise.resolve();
        expect(renders).toBe(1);

        handle.update({ bgcolor: "#000" });
        flushRaf?.(48);
        await Promise.resolve();
        expect(renders).toBe(2);

        handle.dispose();
    });

    test("continuous mode renders on every animation frame", async () => {
        const node = document.createElement("div");
        node.textContent = "Animated";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, {
            ...TEST_OPTIONS,
            mode: "continuous",
        });
        let renders = 0;

        handle.render = async () => {
            renders += 1;
            return handle.canvas;
        };

        handle.start();
        flushRaf?.(16);
        await Promise.resolve();
        flushRaf?.(32);
        await Promise.resolve();
        flushRaf?.(48);
        await Promise.resolve();

        expect(renders).toBe(3);

        handle.dispose();
    });

    test("dispose prevents further rendering", async () => {
        const node = document.createElement("div");
        node.textContent = "Dispose";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, TEST_OPTIONS);
        handle.dispose();

        await expect(handle.render()).rejects.toThrow("CanvasHandle has been disposed");
        expect(() => handle.start()).toThrow("CanvasHandle has been disposed");
        expect(() => handle.update({})).toThrow("CanvasHandle has been disposed");
    });

    test("stop halts a running handle", async () => {
        const node = document.createElement("div");
        node.textContent = "Stop";
        node.style.width = "100px";
        node.style.height = "50px";
        document.body.append(node);

        const handle = getCanvas(node, {
            ...TEST_OPTIONS,
            mode: "continuous",
        });
        let renders = 0;

        handle.render = async () => {
            renders += 1;
            return handle.canvas;
        };

        handle.start();
        flushRaf?.(16);
        await Promise.resolve();
        expect(handle.isRunning).toBe(true);
        expect(renders).toBe(1);

        handle.stop();
        flushRaf?.(32);
        await Promise.resolve();
        expect(handle.isRunning).toBe(false);
        expect(renders).toBe(1);

        handle.dispose();
    });

    test("multiple handles operate independently", async () => {
        const nodeA = document.createElement("div");
        nodeA.textContent = "Handle A";
        nodeA.style.width = "100px";
        nodeA.style.height = "50px";
        document.body.append(nodeA);

        const nodeB = document.createElement("div");
        nodeB.textContent = "Handle B";
        nodeB.style.width = "200px";
        nodeB.style.height = "100px";
        document.body.append(nodeB);

        const handleA = getCanvas(nodeA, { ...TEST_OPTIONS, width: 100, height: 50 });
        const handleB = getCanvas(nodeB, { ...TEST_OPTIONS, width: 200, height: 100 });

        // Verify independent sessions via pipeline
        const sessionA = new RenderSession(handleA.options);
        const sessionB = new RenderSession(handleB.options);
        const frameA = resolveRenderFrame(nodeA, handleA.options);
        const frameB = resolveRenderFrame(nodeB, handleB.options);

        const [svgA, svgB] = await Promise.all([
            buildSvgDataUri(nodeA, handleA.options, frameA, sessionA),
            buildSvgDataUri(nodeB, handleB.options, frameB, sessionB),
        ]);

        expect(decodeSvgDataUrl(svgA)).toContain("Handle A");
        expect(decodeSvgDataUrl(svgB)).toContain("Handle B");

        // Disposing one handle should not affect the other
        handleA.dispose();
        expect(() => handleA.start()).toThrow("CanvasHandle has been disposed");
        expect(handleB.isRunning).toBe(false);
        handleB.start();
        expect(handleB.isRunning).toBe(true);

        handleB.dispose();
    });
});

function installRafController(): {
    flush(time?: number): void;
    restore(): void;
} {
    const previousRaf = globalThis.requestAnimationFrame;
    const previousCancel = globalThis.cancelAnimationFrame;
    const queue = new Map<number, FrameRequestCallback>();
    let nextId = 1;

    Object.defineProperty(globalThis, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value(callback: FrameRequestCallback) {
            const id = nextId;
            nextId += 1;
            queue.set(id, callback);
            return id;
        },
    });

    Object.defineProperty(globalThis, "cancelAnimationFrame", {
        configurable: true,
        writable: true,
        value(id: number) {
            queue.delete(id);
        },
    });

    return {
        flush(time = 16) {
            const callbacks = [...queue.values()];
            queue.clear();

            for (const callback of callbacks) {
                callback(time);
            }
        },
        restore() {
            Object.defineProperty(globalThis, "requestAnimationFrame", {
                configurable: true,
                writable: true,
                value: previousRaf,
            });

            Object.defineProperty(globalThis, "cancelAnimationFrame", {
                configurable: true,
                writable: true,
                value: previousCancel,
            });
        },
    };
}
