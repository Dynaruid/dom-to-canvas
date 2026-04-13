# dom-to-canvas-react

[![JSR](https://jsr.io/badges/@dynaruid/dom-to-canvas-react)](https://jsr.io/@dynaruid/dom-to-canvas-react)
[![JSR Score](https://jsr.io/badges/@dynaruid/dom-to-canvas-react/score)](https://jsr.io/@dynaruid/dom-to-canvas-react)
[![JSR Weekly Downloads](https://jsr.io/badges/@dynaruid/dom-to-canvas-react/weekly-downloads)](https://jsr.io/@dynaruid/dom-to-canvas-react)

React bindings for `@dynaruid/dom-to-canvas`.

## Install

```bash
deno add jsr:@dynaruid/dom-to-canvas-react
```

```bash
bunx jsr add @dynaruid/dom-to-canvas-react
```

```bash
npx jsr add @dynaruid/dom-to-canvas-react
```

## Quick Start

```tsx
import { DomFrame, useDomFrame } from "@dynaruid/dom-to-canvas-react";

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

## Exports

- `DomFrame`
- `useDomRenderer`
- `useDomFrame`

## Development

```bash
bun test
bun run typecheck
```

## License

MIT.
