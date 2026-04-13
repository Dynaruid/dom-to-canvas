import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactElement,
  type ReactNode
} from "react";

import {
  Renderer,
  getCanvas,
  type RenderSize,
  type CanvasHandle
} from "@dynaruid/dom-to-canvas";
import type { Options } from "@dynaruid/dom-to-canvas";

export interface DomPixelDataResult {
  pixels: Uint8Array;
  width: number;
  height: number;
}

export interface DomPixelWriteTarget {
  target: Uint8Array;
  commit?: (
    result: DomPixelDataResult
  ) => void | Promise<void>;
}

export interface DomPixelWriter {
  prepare(
    size: RenderSize
  ): Uint8Array | DomPixelWriteTarget | null;
}

export interface DomFrameSize {
  width: number;
  height: number;
}

export interface DomFrameState {
  frame: number;
  time: number;
  delta: number;
  element: HTMLDivElement;
  renderer: Renderer;
  size: DomFrameSize;
  isCapturing: boolean;
  toPixelData(
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  writePixelData(
    writer: DomPixelWriter,
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  copyPixelData(
    target: Uint8Array,
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  toPng(options?: Options): Promise<string | null>;
  toJpeg(options?: Options): Promise<string | null>;
  toBlob(options?: Options): Promise<Blob | null>;
}

export type DomFrameCallback = (
  state: DomFrameState
) => void;

export interface DomRendererController {
  readonly element: HTMLDivElement | null;
  readonly renderer: Renderer | null;
  readonly frame: number;
  readonly time: number;
  readonly delta: number;
  readonly isCapturing: boolean;
  subscribe(callback: DomFrameCallback): () => void;
  getState(): DomFrameState | null;
  toPixelData(
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  writePixelData(
    writer: DomPixelWriter,
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  copyPixelData(
    target: Uint8Array,
    options?: Options
  ): Promise<DomPixelDataResult | null>;
  toPng(options?: Options): Promise<string | null>;
  toJpeg(options?: Options): Promise<string | null>;
  toBlob(options?: Options): Promise<Blob | null>;
}

export interface DomFrameProps {
  children: ReactNode;
  active?: boolean;
  intervalMs?: number;
  captureOptions?: Options;
  onFrame?: DomFrameCallback;
  className?: string;
  style?: CSSProperties;
}

const DomFrameContext =
  createContext<DomRendererController | null>(null);

export function DomFrame({
  children,
  active = true,
  intervalMs = 0,
  captureOptions,
  onFrame,
  className,
  style
}: DomFrameProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const inFlightRef = useRef(false);
  const subscribersRef = useRef(
    new Set<DomFrameCallback>()
  );
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const deltaRef = useRef(0);
  const activeRef = useRef(active);
  const intervalMsRef = useRef(intervalMs);
  const captureOptionsRef = useRef(captureOptions);
  const onFrameRef = useRef(onFrame);
  const controllerRef =
    useRef<DomRendererController | null>(null);

  activeRef.current = active;
  intervalMsRef.current = intervalMs;
  captureOptionsRef.current = captureOptions;
  onFrameRef.current = onFrame;

  if (controllerRef.current === null) {
    controllerRef.current = {
      get element() {
        return containerRef.current;
      },
      get renderer() {
        return rendererRef.current;
      },
      get frame() {
        return frameRef.current;
      },
      get time() {
        return timeRef.current;
      },
      get delta() {
        return deltaRef.current;
      },
      get isCapturing() {
        return inFlightRef.current;
      },
      subscribe(callback) {
        subscribersRef.current.add(callback);
        return () => {
          subscribersRef.current.delete(callback);
        };
      },
      getState() {
        return buildState();
      },
      toPixelData(options) {
        return renderPixelData(options);
      },
      writePixelData(writer, options) {
        return writeRenderedPixelData(writer, options);
      },
      copyPixelData(target, options) {
        return copyRenderedPixelData(target, options);
      },
      toPng(options) {
        return renderPng(options);
      },
      toJpeg(options) {
        return renderJpeg(options);
      },
      toBlob(options) {
        return renderBlob(options);
      }
    };
  }

  useEffect(() => {
    const renderer = new Renderer();
    rendererRef.current = renderer;

    return () => {
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    let running = true;
    let rafId = 0;

    function step(timestamp: number) {
      if (!running) {
        return;
      }

      rafId = requestAnimationFrame(step);

      if (!activeRef.current) {
        timeRef.current = 0;
        deltaRef.current = 0;
        return;
      }

      const previousTime = timeRef.current;
      if (
        previousTime !== 0 &&
        timestamp - previousTime < intervalMsRef.current
      ) {
        return;
      }

      timeRef.current = timestamp;
      deltaRef.current =
        previousTime === 0 ? 0 : timestamp - previousTime;
      frameRef.current += 1;

      const state = buildState();
      if (state === null) {
        return;
      }

      const frameCallback = onFrameRef.current;
      if (frameCallback !== undefined) {
        invokeFrameCallback(frameCallback, state);
      }

      for (const subscriber of subscribersRef.current) {
        invokeFrameCallback(subscriber, state);
      }
    }

    rafId = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      frameRef.current = 0;
      timeRef.current = 0;
      deltaRef.current = 0;
    };
  }, []);

  return (
    <DomFrameContext.Provider value={controllerRef.current}>
      <div
        ref={containerRef}
        className={className}
        style={{ width: "100%", height: "100%", ...style }}
      >
        {children}
      </div>
    </DomFrameContext.Provider>
  );

  function buildState(): DomFrameState | null {
    const controller = controllerRef.current;
    const element = containerRef.current;
    const renderer = rendererRef.current;

    if (
      controller === null ||
      element === null ||
      renderer === null
    ) {
      return null;
    }

    return {
      frame: frameRef.current,
      time: timeRef.current,
      delta: deltaRef.current,
      element,
      renderer,
      size: {
        width: element.offsetWidth,
        height: element.offsetHeight
      },
      isCapturing: inFlightRef.current,
      toPixelData: controller.toPixelData,
      writePixelData: controller.writePixelData,
      copyPixelData: controller.copyPixelData,
      toPng: controller.toPng,
      toJpeg: controller.toJpeg,
      toBlob: controller.toBlob
    };
  }

  function mergeCaptureOptions(options?: Options): Options {
    return {
      ...(captureOptionsRef.current ?? {}),
      ...(options ?? {})
    };
  }

  async function withCapture<T>(
    capture: (
      element: HTMLDivElement,
      renderer: Renderer,
      options: Options
    ) => Promise<T | null>,
    options?: Options
  ): Promise<T | null> {
    const element = containerRef.current;
    const renderer = rendererRef.current;

    if (
      element === null ||
      renderer === null ||
      inFlightRef.current
    ) {
      return null;
    }

    inFlightRef.current = true;
    try {
      return await capture(
        element,
        renderer,
        mergeCaptureOptions(options)
      );
    } finally {
      inFlightRef.current = false;
    }
  }

  async function renderPixelData(
    options?: Options
  ): Promise<DomPixelDataResult | null> {
    return writeRenderedPixelData(
      {
        prepare(size) {
          return new Uint8Array(size.byteLength);
        }
      },
      options
    );
  }

  async function writeRenderedPixelData(
    writer: DomPixelWriter,
    options?: Options
  ): Promise<DomPixelDataResult | null> {
    return withCapture(
      async (element, renderer, mergedOptions) => {
        const size = renderer.measure(
          element,
          mergedOptions
        );
        if (size.byteLength === 0) {
          return null;
        }

        const prepared = writer.prepare(size);
        if (prepared === null) {
          return null;
        }

        const target = normalizePixelWriteTarget(prepared);
        const result = await renderer.copyPixelData(
          element,
          target.target,
          mergedOptions
        );

        const pixelResult = {
          pixels: result.pixels,
          width: result.width,
          height: result.height
        };

        if (target.commit) {
          await target.commit(pixelResult);
        }

        return pixelResult;
      },
      options
    );
  }

  async function copyRenderedPixelData(
    target: Uint8Array,
    options?: Options
  ): Promise<DomPixelDataResult | null> {
    return writeRenderedPixelData(
      {
        prepare() {
          return target;
        }
      },
      options
    );
  }

  async function renderPng(
    options?: Options
  ): Promise<string | null> {
    return withCapture(
      async (element, renderer, mergedOptions) => {
        const dataUrl = await renderer.toPng(
          element,
          mergedOptions
        );
        return dataUrl;
      },
      options
    );
  }

  async function renderJpeg(
    options?: Options
  ): Promise<string | null> {
    return withCapture(
      async (element, renderer, mergedOptions) => {
        const dataUrl = await renderer.toJpeg(
          element,
          mergedOptions
        );
        return dataUrl;
      },
      options
    );
  }

  async function renderBlob(
    options?: Options
  ): Promise<Blob | null> {
    return withCapture(
      async (element, renderer, mergedOptions) => {
        const blob = await renderer.toBlob(
          element,
          mergedOptions
        );
        return blob;
      },
      options
    );
  }
}

export function useDomRenderer(): DomRendererController {
  const controller = useContext(DomFrameContext);
  if (controller === null) {
    throw new Error(
      "useDomRenderer must be used within <DomFrame>."
    );
  }
  return controller;
}

export function useDomFrame(
  callback: DomFrameCallback
): void {
  const controller = useDomRenderer();
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(() => {
    return controller.subscribe((state) => {
      callbackRef.current(state);
    });
  }, [controller]);
}

function invokeFrameCallback(
  callback: DomFrameCallback,
  state: DomFrameState
): void {
  try {
    callback(state);
  } catch (error) {
    console.error(
      "[DomFrame] frame callback failed:",
      error
    );
  }
}

function normalizePixelWriteTarget(
  prepared: Uint8Array | DomPixelWriteTarget
): DomPixelWriteTarget {
  if (prepared instanceof Uint8Array) {
    return { target: prepared };
  }

  return prepared;
}

export function useCanvasHandle(
  ref: RefObject<HTMLElement | null>,
  options?: Options
): CanvasHandle | null {
  const [handle, setHandle] = useState<CanvasHandle | null>(
    null
  );
  const previousOptionsRef = useRef<Options | undefined>(
    options
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setHandle(null);
      return;
    }

    const nextHandle = getCanvas(el, options);
    previousOptionsRef.current = options;
    setHandle(nextHandle);

    return () => {
      setHandle((current) =>
        current === nextHandle ? null : current
      );
      nextHandle.dispose();
    };
  }, [ref]);

  useEffect(() => {
    if (handle === null) {
      return;
    }

    const previousOptions =
      previousOptionsRef.current ?? {};
    const nextOptions = options ?? {};
    const updateOptions = {
      ...nextOptions
    } as Options & Record<string, unknown>;

    for (const key of Object.keys(previousOptions) as Array<
      keyof Options
    >) {
      if (!(key in nextOptions)) {
        updateOptions[key] = undefined;
      }
    }

    handle.update(updateOptions);
    previousOptionsRef.current = options;
  }, [handle, options]);

  return handle;
}
