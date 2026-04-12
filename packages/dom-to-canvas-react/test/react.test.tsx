import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test
} from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { setupDomEnvironment } from "./support/dom.ts";

const dom = setupDomEnvironment();
const reactDomCanvas = await import("../src/react.tsx");
const { Renderer } = await import("dom-to-canvas");

const { DomFrame, useDomFrame, useDomRenderer } =
  reactDomCanvas;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let restoreCanvasApis: (() => void) | null = null;
let restoreRaf: (() => void) | null = null;
let flushRaf: ((time?: number) => void) | null = null;
const previousActEnvironment = (
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  dom.reset();
  restoreCanvasApis = installCanvasApis();

  const rafController = installRafController();
  restoreRaf = rafController.restore;
  flushRaf = rafController.flush;

  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
  }

  host?.remove();
  root = null;
  host = null;
  flushRaf = null;

  restoreRaf?.();
  restoreCanvasApis?.();
  restoreRaf = null;
  restoreCanvasApis = null;
});

afterAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  dom.cleanup();
});

describe("DomFrame", () => {
  test("runs subscribed callbacks on each animation frame", async () => {
    const frames: number[] = [];
    const deltas: number[] = [];

    function Probe() {
      useDomFrame((state) => {
        frames.push(state.frame);
        deltas.push(state.delta);
      });

      return <span>probe</span>;
    }

    await act(async () => {
      root?.render(
        <DomFrame>
          <Probe />
        </DomFrame>
      );
    });

    await act(async () => {
      flushRaf?.(16);
      flushRaf?.(32);
    });

    expect(frames).toEqual([1, 2]);
    expect(deltas).toEqual([0, 16]);
  });

  test("does not expose a render helper on state or controller", async () => {
    let controllerHasRender = true;
    let stateHasRender = true;

    function Probe() {
      const controller = useDomRenderer();
      controllerHasRender = "render" in controller;

      useDomFrame((state) => {
        if (state.frame !== 1) {
          return;
        }

        stateHasRender = "render" in state;
      });

      return <span>probe</span>;
    }

    await act(async () => {
      root?.render(
        <DomFrame>
          <Probe />
        </DomFrame>
      );
    });

    await act(async () => {
      flushRaf?.(16);
    });

    expect(controllerHasRender).toBe(false);
    expect(stateHasRender).toBe(false);
  });

  test("copies pixel data into a caller-provided buffer", async () => {
    const originalCopyPixelData =
      Renderer.prototype.copyPixelData;
    const target = new Uint8Array(16);
    let copiedLength = 0;
    let copiedBufferMatches = false;

    Renderer.prototype.copyPixelData =
      async function copyPixelDataStub(_node, buffer) {
        buffer.set([1, 2, 3, 4]);

        return {
          pixels: buffer.subarray(0, 4),
          width: 1,
          height: 1,
          byteLength: 4
        };
      };

    try {
      function Probe() {
        useDomFrame((state) => {
          if (state.frame !== 1) {
            return;
          }

          void state
            .copyPixelData(target)
            .then((result) => {
              if (result === null) {
                return;
              }

              copiedLength = result.pixels.length;
              copiedBufferMatches =
                result.pixels.buffer === target.buffer;
            });
        });

        return <span>probe</span>;
      }

      await act(async () => {
        root?.render(
          <DomFrame>
            <Probe />
          </DomFrame>
        );
      });

      await act(async () => {
        flushRaf?.(16);
        await Promise.resolve();
      });

      expect(Array.from(target.slice(0, 4))).toEqual([
        1, 2, 3, 4
      ]);
      expect(copiedLength).toBe(4);
      expect(copiedBufferMatches).toBe(true);
    } finally {
      Renderer.prototype.copyPixelData =
        originalCopyPixelData;
    }
  });

  test("writes pixel data through a high-level writer", async () => {
    const originalMeasure = Renderer.prototype.measure;
    const originalCopyPixelData =
      Renderer.prototype.copyPixelData;
    const target = new Uint8Array(16);
    let preparedByteLength = 0;
    let committed = false;

    Renderer.prototype.measure = function measureStub() {
      return {
        width: 1,
        height: 1,
        byteLength: 4
      };
    };

    Renderer.prototype.copyPixelData =
      async function copyPixelDataStub(_node, buffer) {
        buffer.set([9, 8, 7, 6]);

        return {
          pixels: buffer.subarray(0, 4),
          width: 1,
          height: 1,
          byteLength: 4
        };
      };

    try {
      function Probe() {
        useDomFrame((state) => {
          if (state.frame !== 1) {
            return;
          }

          void state.writePixelData({
            prepare(size) {
              preparedByteLength = size.byteLength;
              return {
                target,
                commit(result) {
                  committed =
                    result.width === 1 &&
                    result.height === 1 &&
                    result.pixels.buffer === target.buffer;
                }
              };
            }
          });
        });

        return <span>probe</span>;
      }

      await act(async () => {
        root?.render(
          <DomFrame>
            <Probe />
          </DomFrame>
        );
      });

      await act(async () => {
        flushRaf?.(16);
        await Promise.resolve();
      });

      expect(preparedByteLength).toBe(4);
      expect(Array.from(target.slice(0, 4))).toEqual([
        9, 8, 7, 6
      ]);
      expect(committed).toBe(true);
    } finally {
      Renderer.prototype.measure = originalMeasure;
      Renderer.prototype.copyPixelData =
        originalCopyPixelData;
    }
  });
});

type FakeCanvasContext = {
  clearRect(): void;
  fillRect(): void;
  drawImage(): void;
  save(): void;
  restore(): void;
  scale(): void;
  setTransform(): void;
  getImageData(
    x: number,
    y: number,
    width: number,
    height: number
  ): {
    data: Uint8ClampedArray;
  };
  fillStyle: string;
  imageSmoothingEnabled: boolean;
};

function installCanvasApis(): () => void {
  const originalGetContext =
    HTMLCanvasElement.prototype.getContext;
  const originalToDataURL =
    HTMLCanvasElement.prototype.toDataURL;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "getContext",
    {
      configurable: true,
      writable: true,
      value(kind: string) {
        if (kind !== "2d") {
          return null;
        }

        const context: FakeCanvasContext = {
          fillStyle: "",
          imageSmoothingEnabled: false,
          clearRect() {},
          fillRect() {},
          drawImage() {},
          save() {},
          restore() {},
          scale() {},
          setTransform() {},
          getImageData(_x, _y, width, height) {
            return {
              data: new Uint8ClampedArray(
                width * height * 4
              )
            };
          }
        };

        return context;
      }
    }
  );

  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "toDataURL",
    {
      configurable: true,
      writable: true,
      value(type?: string) {
        return `data:${type ?? "image/png"};base64,ZmFrZQ==`;
      }
    }
  );

  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "toBlob",
    {
      configurable: true,
      writable: true,
      value(
        callback: (blob: Blob | null) => void,
        type?: string
      ) {
        callback(
          new Blob(["fake"], { type: type ?? "image/png" })
        );
      }
    }
  );

  return () => {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      "getContext",
      {
        configurable: true,
        writable: true,
        value: originalGetContext
      }
    );

    Object.defineProperty(
      HTMLCanvasElement.prototype,
      "toDataURL",
      {
        configurable: true,
        writable: true,
        value: originalToDataURL
      }
    );

    Object.defineProperty(
      HTMLCanvasElement.prototype,
      "toBlob",
      {
        configurable: true,
        writable: true,
        value: originalToBlob
      }
    );
  };
}

function installRafController(): {
  flush(time?: number): void;
  restore(): void;
} {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  Object.defineProperty(
    globalThis,
    "requestAnimationFrame",
    {
      configurable: true,
      writable: true,
      value(callback: FrameRequestCallback) {
        const id = nextId;
        nextId += 1;
        queue.set(id, callback);
        return id;
      }
    }
  );

  Object.defineProperty(
    globalThis,
    "cancelAnimationFrame",
    {
      configurable: true,
      writable: true,
      value(id: number) {
        queue.delete(id);
      }
    }
  );

  return {
    flush(time = 16) {
      const callbacks = [...queue.values()];
      queue.clear();

      for (const callback of callbacks) {
        callback(time);
      }
    },
    restore() {
      Object.defineProperty(
        globalThis,
        "requestAnimationFrame",
        {
          configurable: true,
          writable: true,
          value: previousRaf
        }
      );

      Object.defineProperty(
        globalThis,
        "cancelAnimationFrame",
        {
          configurable: true,
          writable: true,
          value: previousCancel
        }
      );
    }
  };
}
