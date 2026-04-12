# dom-to-canvas

Generates an image from a DOM node using HTML5 canvas and SVG.
TypeScript rewrite of [dom-to-image-more](https://github.com/1904labs/dom-to-image-more), published via JSR.

This package renders browser DOM nodes. Use it in a browser or a browser-like DOM environment.

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

## Usage

```ts
import {
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
```

## API

### `toSvg(node, options?): Promise<string>`

### `toPng(node, options?): Promise<string>`

### `toJpeg(node, options?): Promise<string>`

### `toBlob(node, options?): Promise<Blob>`

### `toCanvas(node, options?): Promise<HTMLCanvasElement>`

### `toPixelData(node, options?): Promise<Uint8ClampedArray>`

### Options

| Option                | Type                           | Default    | Description                         |
| --------------------- | ------------------------------ | ---------- | ----------------------------------- |
| `filter`              | `(node: Node) => boolean`      | —          | Filter out nodes                    |
| `bgcolor`             | `string`                       | —          | Background color                    |
| `width`               | `number`                       | —          | Output width                        |
| `height`              | `number`                       | —          | Output height                       |
| `style`               | `Record<string, string>`       | —          | Inline styles to apply              |
| `quality`             | `number`                       | `1.0`      | JPEG quality (0–1)                  |
| `scale`               | `number`                       | `1`        | Scale multiplier                    |
| `imagePlaceholder`    | `string`                       | —          | Data URL fallback for failed images |
| `cacheBust`           | `boolean`                      | `false`    | Bypass cache for resources          |
| `copyDefaultStyles`   | `boolean`                      | `true`     | Copy default element styles         |
| `styleCaching`        | `"strict" \| "relaxed"`        | `"strict"` | Style computation cache strategy    |
| `disableEmbedFonts`   | `boolean`                      | `false`    | Skip font embedding                 |
| `disableInlineImages` | `boolean`                      | `false`    | Skip image inlining                 |
| `onclone`             | `(clone: HTMLElement) => void` | —          | Callback on cloned DOM              |
| `adjustClonedNode`    | `(orig, clone, after) => void` | —          | Adjust cloned nodes                 |
| `filterStyles`        | `(el, prop) => boolean`        | —          | Filter style properties             |

## Notes

- The package needs `window`, `document`, canvas, and image APIs.
- Cross-origin images and fonts still depend on the browser's security model.
- For Node-based tests, use a browser-like DOM such as `jsdom`.

## Development

```bash
bun test
bun run typecheck
```

## License

MIT.

This project is derived from dom-to-image-more. The upstream author credits are preserved in LICENSE and package metadata.
