import { useEffect, useRef, useCallback } from "react";
import { Application } from "@shadr/editor-app";

type EventMap = {
  keydown: KeyboardEvent;
  keyup: KeyboardEvent;
  mousemove: MouseEvent;
  mousedown: MouseEvent;
  mouseup: MouseEvent;
  wheel: WheelEvent;
  contextmenu: Event;
  touchstart: TouchEvent;
  touchmove: TouchEvent;
  touchend: TouchEvent;
};

type DocumentHandlers = {
  [K in keyof Omit<
    EventMap,
    "keydown" | "keyup" | "touchstart" | "touchmove" | "touchend"
  >]: (e: EventMap[K]) => void;
};

type WindowHandlers = {
  [K in "keydown" | "keyup" | "touchstart" | "touchmove" | "touchend"]: (
    e: EventMap[K]
  ) => void;
};

const ShadrApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const isAppCreatedRef = useRef(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();
  const resizeFrameRef = useRef<number>();

  const handlersRef = useRef<{
    document: DocumentHandlers;
    window: WindowHandlers;
  }>({
    document: {} as DocumentHandlers,
    window: {} as WindowHandlers,
  });

  const updateDimensions = useCallback(() => {
    if (!canvasRef.current || !appRef.current) return;

    const { width, height } = canvasRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const currentDimensions = dimensionsRef.current;

    if (width !== currentDimensions.width || height !== currentDimensions.height) {
      dimensionsRef.current = { width, height };
      canvasRef.current.width = width * dpr;
      canvasRef.current.height = height * dpr;

      appRef.current.handleResize();
    }
  }, []);

  const handleResize = useCallback(() => {
    if (resizeFrameRef.current) {
      cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = requestAnimationFrame(updateDimensions);
  }, [updateDimensions]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const resizeObserver = new ResizeObserver(handleResize);

    async function setupApp() {
      if (isAppCreatedRef.current) return;

      isAppCreatedRef.current = true;
      try {
        const app = new Application();
        await app.init(canvasRef.current!);

        appRef.current = app;

        handlersRef.current.document = {
          mousemove: (e: MouseEvent) => app.events()?.handleMouseMove(e),
          mousedown: (e: MouseEvent) => app.events()?.handleMouseDown(e),
          mouseup: (e: MouseEvent) => app.events()?.handleMouseUp(e),
          wheel: (e: WheelEvent) => app.events()?.handleMouseWheel(e),
          contextmenu: (e: Event) => e.preventDefault(),
        };

        handlersRef.current.window = {
          keydown: (e: KeyboardEvent) => app.events()?.handleKeyDown(e),
          keyup: (e: KeyboardEvent) => app.events()?.handleKeyUp(e),
          touchstart: (e: TouchEvent) => app.events()?.handleTouchStart(e),
          touchmove: (e: TouchEvent) => app.events()?.handleTouchMove(e),
          touchend: (e: TouchEvent) => app.events()?.handleTouchEnd(e),
        };

        Object.entries(handlersRef.current.document).forEach(([event, handler]) => {
          if (event === "wheel") {
            document.addEventListener(event, handler as EventListener, {
              passive: false,
            });
          } else {
            document.addEventListener(event, handler as EventListener);
          }
        });

        Object.entries(handlersRef.current.window).forEach(([event, handler]) => {
          window.addEventListener(event, handler as EventListener);
        });

        if (canvasRef.current) {
          resizeObserver.observe(canvasRef.current);
        }

        app.run();
      } catch (err) {
        console.error(err);
        isAppCreatedRef.current = false;
        return;
      }
    }

    setupApp();

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeObserver.disconnect();

      Object.entries(handlersRef.current.document).forEach(([event, handler]) => {
        document.removeEventListener(event, handler as EventListener);
      });

      Object.entries(handlersRef.current.window).forEach(([event, handler]) => {
        window.removeEventListener(event, handler as EventListener);
      });

      if (appRef.current) {
        appRef.current.destroy();
        appRef.current = null;
        isAppCreatedRef.current = false;
      }
    };
  }, [handleResize]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default ShadrApp;
