import { useEffect, useRef, useCallback } from "react";
import { createApplication } from "@shadr/editor-app";

type EventMap = {
  keydown: KeyboardEvent;
  keyup: KeyboardEvent;
  mousemove: MouseEvent;
  mousedown: MouseEvent;
  mouseup: MouseEvent;
  wheel: WheelEvent;
  contextmenu: Event;
};

type DocumentHandlers = {
  [K in keyof Omit<EventMap, "keydown" | "keyup">]: (e: EventMap[K]) => void;
};

type WindowHandlers = {
  [K in "keydown" | "keyup"]: (e: EventMap[K]) => void;
};

const ShadrApp = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Awaited<ReturnType<typeof createApplication>> | null>(null);
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
    if (containerRef.current && appRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const currentDimensions = dimensionsRef.current;

      if (width !== currentDimensions.width || height !== currentDimensions.height) {
        dimensionsRef.current = { width, height };
        appRef.current.canvas!.width = width * dpr;
        appRef.current.canvas!.height = height * dpr;
        appRef.current.handleResize();
      }
    }
  }, []);

  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    if (resizeFrameRef.current) {
      cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      resizeFrameRef.current = requestAnimationFrame(updateDimensions);
    }, 250);
  }, [updateDimensions]);

  useEffect(() => {
    if (!containerRef.current || isAppCreatedRef.current) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    dimensionsRef.current = { width, height };

    const resizeObserver = new ResizeObserver(handleResize);

    async function setupApp() {
      if (isAppCreatedRef.current) return;

      isAppCreatedRef.current = true;
      const app = await createApplication({
        width: width * dpr,
        height: height * dpr,
      });

      if (!app) {
        console.error("Failed to create application");
        return;
      }

      appRef.current = app;

      handlersRef.current.document = {
        mousemove: (e: MouseEvent) => app.handleMouseMove(e),
        mousedown: (e: MouseEvent) => app.handleMouseDown(e),
        mouseup: (e: MouseEvent) => app.handleMouseUp(e),
        wheel: (e: WheelEvent) => app.handleMouseWheel(e),
        contextmenu: (e: Event) => e.preventDefault(),
      };

      handlersRef.current.window = {
        keydown: (e: KeyboardEvent) => app.handleKeyDown(e),
        keyup: (e: KeyboardEvent) => app.handleKeyUp(e),
      };

      Object.entries(handlersRef.current.document).forEach(([event, handler]) => {
        document.addEventListener(event, handler as EventListener);
      });

      Object.entries(handlersRef.current.window).forEach(([event, handler]) => {
        window.addEventListener(event, handler as EventListener);
      });

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas!);
        resizeObserver.observe(containerRef.current);
      }

      try {
        app.run();
      } catch (err) {
        console.error(err);
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

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
};

export default ShadrApp;
