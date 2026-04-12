import type { Options } from "./types.ts";
import * as util from "./util.ts";

export interface ResolvedRenderFrame {
    scale: number;
    sourceWidth: number;
    sourceHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    byteLength: number;
}

export function resolveRenderFrame(
    node: Node,
    options: Options = {},
): ResolvedRenderFrame {
    const scale = typeof options.scale !== "number" ? 1 : options.scale;

    let sourceWidth = options.width || util.width(node);
    let sourceHeight = options.height || util.height(node);

    if (util.isDimensionMissing(sourceWidth)) {
        sourceWidth = util.isDimensionMissing(sourceHeight)
            ? 300
            : sourceHeight * 2.0;
    }
    if (util.isDimensionMissing(sourceHeight)) {
        sourceHeight = sourceWidth / 2.0;
    }

    const canvasWidth = Math.max(0, Math.trunc(sourceWidth * scale));
    const canvasHeight = Math.max(0, Math.trunc(sourceHeight * scale));

    return {
        scale,
        sourceWidth,
        sourceHeight,
        canvasWidth,
        canvasHeight,
        byteLength: canvasWidth * canvasHeight * 4,
    };
}
