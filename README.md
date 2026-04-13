# dom-to-canvas

Monorepo for the `@dynaruid/dom-to-canvas` core renderer and the `@dynaruid/dom-to-canvas-react` bindings package.

## Packages

| Package | Location | Summary |
| --- | --- | --- |
| `@dynaruid/dom-to-canvas` | `packages/dom-to-canvas` | One-shot DOM export helpers plus live `getCanvas(node, options?)` handles |
| `@dynaruid/dom-to-canvas-react` | `packages/dom-to-canvas-react` | React bindings for frame callbacks and live canvas handles |

## API Shape

### One-shot export

Use the core package when you want a single capture:

- `toSvg`
- `toPng`
- `toJpeg`
- `toBlob`
- `toPixelData`
- `copyPixelData`
- `toCanvas` as a deprecated compatibility alias

### Live rendering

Use `getCanvas(node, options?)` when you want a persistent canvas that can be re-rendered, started, stopped, resized, and disposed.

Live handles support two invalidation modes:

- `mode: "dirty"` renders once, then waits for DOM mutation, resize, or explicit `update()` / `resize()` calls.
- `mode: "continuous"` renders every animation frame while running.

CSS animations and transitions should use `mode: "continuous"`. Dirty mode does not try to sample pure computed-style animation frames automatically.

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
bun run typecheck
```

Run React package tests:

```bash
cd packages/dom-to-canvas-react
bun test
bun run typecheck
```

## Publishing Notes

- `packages/dom-to-canvas` is the publishable core package.
- `packages/dom-to-canvas-react` is the publishable React bindings package.

## License

MIT.

This project is derived from dom-to-image-more. Upstream credits are preserved in package metadata and license files.