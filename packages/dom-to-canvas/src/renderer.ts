import type { Options } from "./types.ts";
import {
    resolveRenderFrame,
    type ResolvedRenderFrame,
} from "./render-size.ts";
import * as util from "./util.ts";
import { RenderSession } from "./state.ts";
import { buildSvgDataUri } from "./pipeline.ts";

export interface RenderSize {
    width: number;
    height: number;
    byteLength: number;
}

export interface PixelCopyResult {
    pixels: Uint8Array;
    width: number;
    height: number;
    byteLength: number;
}

const CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = {
    willReadFrequently: true,
};

export class Renderer {
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _configuredContext: CanvasRenderingContext2D | null = null;
    readonly session: RenderSession;

    constructor() {
        this._canvas = document.createElement("canvas");
        this.session = new RenderSession();
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    get width(): number {
        return this._canvas.width;
    }

    get height(): number {
        return this._canvas.height;
    }

    measure(node: Node, options: Options = {}): RenderSize {
        const frame = resolveRenderFrame(node, options);
        return {
            width: frame.canvasWidth,
            height: frame.canvasHeight,
            byteLength: frame.byteLength,
        };
    }

    async toPixelData(
        node: Node,
        options?: Options,
    ): Promise<Uint8ClampedArray> {
        const frame = resolveRenderFrame(node, options);
        const ctx = await this._draw(node, options, frame);
        return ctx.getImageData(
            0,
            0,
            frame.canvasWidth,
            frame.canvasHeight,
        ).data;
    }

    async copyPixelData(
        node: Node,
        target: Uint8Array,
        options?: Options,
    ): Promise<PixelCopyResult> {
        const frame = resolveRenderFrame(node, options);
        const ctx = await this._draw(node, options, frame);
        const imageData = ctx.getImageData(
            0,
            0,
            frame.canvasWidth,
            frame.canvasHeight,
        ).data;

        if (target.byteLength < frame.byteLength) {
            throw new RangeError(
                `Target pixel buffer is too small: expected at least ${frame.byteLength} bytes, received ${target.byteLength}.`,
            );
        }

        const pixels = target.subarray(0, frame.byteLength);
        pixels.set(imageData);

        return {
            pixels,
            width: frame.canvasWidth,
            height: frame.canvasHeight,
            byteLength: frame.byteLength,
        };
    }

    async toJpeg(node: Node, options?: Options): Promise<string> {
        await this._draw(node, options);
        return this._canvas.toDataURL(
            "image/jpeg",
            options?.quality ?? 1.0,
        );
    }

    async render(node: Node, options?: Options): Promise<HTMLCanvasElement> {
        await this._draw(node, options);
        return this._canvas;
    }

    async toPng(node: Node, options?: Options): Promise<string> {
        await this._draw(node, options);
        return this._canvas.toDataURL();
    }

    async toBlob(node: Node, options?: Options): Promise<Blob> {
        await this._draw(node, options);
        return util.canvasToBlob(this._canvas);
    }

    dispose(): void {
        this.session.clearUrlCache();
        this._configuredContext = null;
        this._ctx = null;
        this._canvas.width = 0;
        this._canvas.height = 0;
    }

    private _getContext(): CanvasRenderingContext2D {
        if (this._ctx === null) {
            this._ctx = this._canvas.getContext("2d", CONTEXT_OPTIONS)!;
        }
        return this._ctx;
    }

    private _resize(width: number, height: number): boolean {
        if (this._canvas.width === width && this._canvas.height === height) {
            return false;
        }

        this._canvas.width = width;
        this._canvas.height = height;
        this._ctx = null;
        return true;
    }

    private async _draw(
        node: Node,
        options: Options = {},
        frame: ResolvedRenderFrame = resolveRenderFrame(node, options),
    ): Promise<CanvasRenderingContext2D> {
        this.session.updateOptions(options);
        const svgDataUri = await buildSvgDataUri(node, options, frame, this.session);
        const imagePromise = util.makeImage(svgDataUri, this.session);
        const resized = this._resize(
            frame.canvasWidth,
            frame.canvasHeight,
        );

        const ctx = this._getContext();
        this._configureContext(ctx, resized);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (!resized) {
            ctx.clearRect(
                0,
                0,
                frame.canvasWidth,
                frame.canvasHeight,
            );
        }

        if (options.bgcolor) {
            ctx.fillStyle = options.bgcolor;
            ctx.fillRect(
                0,
                0,
                frame.canvasWidth,
                frame.canvasHeight,
            );
        }

        const image = await imagePromise;
        if (!image) {
            return ctx;
        }

        if (frame.scale === 1) {
            ctx.drawImage(image, 0, 0);
        } else {
            ctx.save();
            ctx.scale(frame.scale, frame.scale);
            ctx.drawImage(image, 0, 0);
            ctx.restore();
        }

        return ctx;
    }

    private _configureContext(
        ctx: CanvasRenderingContext2D,
        force = false,
    ): void {
        if (!force && this._configuredContext === ctx) {
            return;
        }

        (
            ctx as unknown as Record<string, unknown>
        ).msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        this._configuredContext = ctx;
    }
}
