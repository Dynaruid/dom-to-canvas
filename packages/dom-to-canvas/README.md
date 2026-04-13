# dom-to-canvas

[![JSR](https://jsr.io/badges/@dynaruid/dom-to-canvas)](https://jsr.io/@dynaruid/dom-to-canvas)
[![JSR Score](https://jsr.io/badges/@dynaruid/dom-to-canvas/score)](https://jsr.io/@dynaruid/dom-to-canvas)
[![JSR Weekly Downloads](https://jsr.io/badges/@dynaruid/dom-to-canvas/weekly-downloads)](https://jsr.io/@dynaruid/dom-to-canvas)

Generate an image from a DOM node with HTML5 canvas and SVG.
TypeScript rewrite of [dom-to-image-more](https://github.com/1904labs/dom-to-image-more), published on JSR.

This package renders browser DOM nodes. Use it in a browser or a browser-like DOM environment.

## Why

- Export any DOM subtree as PNG, JPEG, SVG, Blob, canvas, or raw pixel data.
- Keep a live canvas handle when you need repeated or continuous rendering.
- Keep computed styles, form values, fonts, and images in the rendered output.
- Use one API across browser apps, tests, and browser-like DOM environments.

## Install

```bash
deno add jsr:@dynaruid/dom-to-canvas
```

```bash
bunx jsr add @dynaruid/dom-to-canvas
```

```bash
npx jsr add @dynaruid/dom-to-canvas
```

## Quick Start

### One-shot export

```ts
import {
  copyPixelData,
  getCanvas,
  toPng,
  toSvg,
  toJpeg,
  toBlob,
  toCanvas,
  toPixelData
} from "@dynaruid/dom-to-canvas";

// PNG data URL
const dataUrl = await toPng(
  document.getElementById("my-node")!
);

// SVG data URL
const svgDataUrl = await toSvg(node, {
  bgcolor: "#fff",
  width: 800,
  height: 600
});

// JPEG with quality
const jpegUrl = await toJpeg(node, { quality: 0.8 });

// Blob
const blob = await toBlob(node);

// Canvas element
const canvas = await toCanvas(node, { scale: 2 });

// Raw pixel data
const pixels = await toPixelData(node);

// Write into an existing buffer
const target = new Uint8Array(4 * 800 * 600);
const result = await copyPixelData(node, target);
console.log(result.width, result.height);
```

### Live canvas

```ts
import { getCanvas } from "@dynaruid/dom-to-canvas";

const handle = getCanvas(node, {
  scale: 2,
  mode: "continuous"
});

document.body.append(handle.canvas);

await handle.render();
handle.start();

// Later
handle.stop();
handle.update({ bgcolor: "#111" });
await handle.render();
handle.dispose();
```

## One-shot vs Live

| API                                     | Result                       | Notes                                     |
| --------------------------------------- | ---------------------------- | ----------------------------------------- |
| `getCanvas(node, options?)`             | `CanvasHandle`               | Live canvas owner with lifecycle controls |
| `toSvg(node, options?)`                 | `Promise<string>`            | SVG data URL                              |
| `toPng(node, options?)`                 | `Promise<string>`            | PNG data URL                              |
| `toJpeg(node, options?)`                | `Promise<string>`            | JPEG data URL                             |
| `toBlob(node, options?)`                | `Promise<Blob>`              | PNG `Blob`                                |
| `toPixelData(node, options?)`           | `Promise<Uint8ClampedArray>` | Copies fresh pixel data                   |
| `copyPixelData(node, target, options?)` | `Promise<PixelCopyResult>`   | Writes into a caller-owned buffer         |
| `toCanvas(node, options?)`              | `Promise<HTMLCanvasElement>` | Deprecated one-shot alias                 |

## CanvasHandle

`getCanvas` returns a handle with these members:

```ts
interface CanvasHandle {
  readonly canvas: HTMLCanvasElement;
  readonly node: Node;
  readonly options: Options;
  readonly isRendering: boolean;
  readonly isRunning: boolean;
  readonly frame: number;

  render(options?: Options): Promise<HTMLCanvasElement>;
  start(): void;
  stop(): void;
  update(options: Options): void;
  resize(options?: Options): void;
  dispose(): void;
}
```

## API

### `getCanvas(node, options?): CanvasHandle`

### `toSvg(node, options?): Promise<string>`

### `toPng(node, options?): Promise<string>`

### `toJpeg(node, options?): Promise<string>`

### `toBlob(node, options?): Promise<Blob>`

### `copyPixelData(node, target, options?): Promise<PixelCopyResult>`

### `toCanvas(node, options?): Promise<HTMLCanvasElement>`

Deprecated compatibility alias for one-shot canvas export.

### `toPixelData(node, options?): Promise<Uint8ClampedArray>`

### `Renderer`

Reusable low-level canvas owner for advanced scenarios.

### `RenderSession`

Low-level per-render resource session used internally by one-shot and live paths.

## Options

| Option                  | Type                           | Default    | Description                         |
| ----------------------- | ------------------------------ | ---------- | ----------------------------------- |
| `filter`                | `(node: Node) => boolean`      | —          | Filter out nodes                    |
| `bgcolor`               | `string`                       | —          | Background color                    |
| `width`                 | `number`                       | —          | Output width                        |
| `height`                | `number`                       | —          | Output height                       |
| `style`                 | `Record<string, string>`       | —          | Inline styles to apply              |
| `quality`               | `number`                       | `1.0`      | JPEG quality (0–1)                  |
| `scale`                 | `number`                       | `1`        | Scale multiplier                    |
| `mode`                  | `"dirty" \| "continuous"`      | `"dirty"`  | Live handle invalidation mode       |
| `imagePlaceholder`      | `string`                       | —          | Data URL fallback for failed images |
| `cacheBust`             | `boolean`                      | `false`    | Bypass cache for resources          |
| `useCredentials`        | `boolean`                      | `false`    | Send credentials while fetching     |
| `useCredentialsFilters` | `(string \| RegExp)[]`         | `[]`       | Restrict credentialed fetches       |
| `httpTimeout`           | `number`                       | `30000`    | Resource fetch timeout in ms        |
| `copyDefaultStyles`     | `boolean`                      | `true`     | Copy default element styles         |
| `styleCaching`          | `"strict" \| "relaxed"`        | `"strict"` | Style computation cache strategy    |
| `disableEmbedFonts`     | `boolean`                      | `false`    | Skip font embedding                 |
| `disableInlineImages`   | `boolean`                      | `false`    | Skip image inlining                 |
| `corsImg`               | `CorsImgConfig`                | —          | Proxy cross-origin image fetches    |
| `onclone`               | `(clone: HTMLElement) => void` | —          | Callback on cloned DOM              |
| `adjustClonedNode`      | `(orig, clone, after) => void` | —          | Adjust cloned nodes                 |
| `filterStyles`          | `(el, prop) => boolean`        | —          | Filter style properties             |

## CSS Animation Policy

- `mode: "dirty"` is the default for live handles. It re-renders on DOM mutation, text changes, attribute changes, observed element resize, and explicit `update()` or `resize()` calls.
- CSS keyframe animations and transitions often change computed styles without mutating the DOM. If the canvas must track those frames, use `mode: "continuous"`.
- One-shot exports ignore `mode` entirely.

## Notes

- The package needs `window`, `document`, canvas, and image APIs.
- Cross-origin images and fonts still depend on the browser's security model.
- For Node-based tests, use a browser-like DOM such as `jsdom`.

## React

If you need React bindings, see [`@dynaruid/dom-to-canvas-react`](https://jsr.io/@dynaruid/dom-to-canvas-react).

## Links

- [JSR package](https://jsr.io/@dynaruid/dom-to-canvas)
- [API docs](https://jsr.io/@dynaruid/dom-to-canvas/doc)
- [GitHub repository](https://github.com/Dynaruid/dom-to-canvas)

## Development

```bash
bun test
bun run typecheck
```

## License

MIT.

This project is derived from dom-to-image-more. The upstream author credits are preserved in LICENSE and package metadata.
