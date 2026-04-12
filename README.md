# dom-to-canvas

Monorepo for the dom-to-canvas packages.

This repository contains the core DOM-to-image renderer and the separate React bindings package.

## Packages

### dom-to-canvas

Core package for rendering DOM nodes to SVG, PNG, JPEG, Blob, or pixel buffers.

Location: `packages/dom-to-canvas`

### dom-to-canvas-react

React bindings built on top of the core renderer.

Location: `packages/dom-to-canvas-react`

## Package Overview

### dom-to-canvas

- Browser-focused DOM renderer
- Exposes `toSvg`, `toPixelData`, `copyPixelData`, `toPng`, `toJpeg`, `toBlob`, and `Renderer`
- No React dependency

### dom-to-canvas-react

- React helpers for frame-based DOM capture workflows
- Depends on `dom-to-canvas` as a peer dependency
- Keeps React-specific code out of the core package

## Repository Layout

```text
packages/
  dom-to-canvas/
  dom-to-canvas-react/
```

## Development

Install workspace dependencies:

```bash
bun install
```

Run core package tests:

```bash
cd packages/dom-to-canvas
bun test
```

Run React package tests:

```bash
cd packages/dom-to-canvas-react
bun test
```

## Publishing Notes

- `packages/dom-to-canvas` is the publishable core package.
- `packages/dom-to-canvas-react` contains the React bindings package.

## License

MIT.

This project is derived from dom-to-image-more. Upstream credits are preserved in package metadata and license files.