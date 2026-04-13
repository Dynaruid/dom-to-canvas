# dom-to-canvas-react

[![JSR](https://jsr.io/badges/@dynaruid/dom-to-canvas-react)](https://jsr.io/@dynaruid/dom-to-canvas-react)
[![JSR Score](https://jsr.io/badges/@dynaruid/dom-to-canvas-react/score)](https://jsr.io/@dynaruid/dom-to-canvas-react)
[![JSR Weekly Downloads](https://jsr.io/badges/@dynaruid/dom-to-canvas-react/weekly-downloads)](https://jsr.io/@dynaruid/dom-to-canvas-react)

React bindings for `@dynaruid/dom-to-canvas`.

## Install

### Deno / JSR

```bash
deno add jsr:@dynaruid/dom-to-canvas-react
```

### npm / Node / Bun

```bash
npm install @dynaruid/dom-to-canvas-react
```

```bash
pnpm add @dynaruid/dom-to-canvas-react
```

```bash
yarn add @dynaruid/dom-to-canvas-react
```

```bash
bun add @dynaruid/dom-to-canvas-react
```

### Deno via npm

```bash
deno add npm:@dynaruid/dom-to-canvas-react
```

The npm package ships ESM output in `dist/` and installs `@dynaruid/dom-to-canvas` automatically. `react` remains a peer dependency and should already exist in the host app.

## Quick Start

### Frame callback workflow

```tsx
import {
  DomFrame,
  useDomFrame
} from "@dynaruid/dom-to-canvas-react";

function CaptureProbe() {
  useDomFrame((state) => {
    if (state.frame === 1) {
      void state.toPng().then((dataUrl) => {
        console.log(dataUrl);
      });
    }
  });

  return <div>Hello canvas</div>;
}

export function App() {
  return (
    <DomFrame>
      <CaptureProbe />
    </DomFrame>
  );
}
```

### Live handle workflow

```tsx
import { useEffect, useRef } from "react";
import { useCanvasHandle } from "@dynaruid/dom-to-canvas-react";

export function LivePreview() {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const handle = useCanvasHandle(sourceRef, {
    mode: "continuous",
    scale: 2
  });

  useEffect(() => {
    if (handle === null) {
      return;
    }

    document.body.append(handle.canvas);
    void handle.render();
    handle.start();

    return () => {
      handle.stop();
    };
  }, [handle]);

  return <div ref={sourceRef}>Hello canvas</div>;
}
```

## Exports

- `DomFrame`
- `useCanvasHandle`
- `useDomRenderer`
- `useDomFrame`
- `CanvasHandle` type re-export

## Choosing an API

- Use `DomFrame` when you want a React-owned frame clock and per-frame callback subscriptions.
- Use `useCanvasHandle` when you want the core live `getCanvas` handle from an element ref.
- For CSS animations or transitions that need to be reflected in the canvas continuously, pass `mode: "continuous"`.

## Development

```bash
bun test
bun run typecheck
```

## License

MIT.
