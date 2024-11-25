import { useEffect, useRef, useState, useCallback } from "react";
import { ShadrApplication } from "@shadr/editor-app";

type EventMap = {
  keydown: KeyboardEvent;
  keyup: KeyboardEvent;
  mousemove: MouseEvent;
  mousedown: MouseEvent;
  mouseup: MouseEvent;
  wheel: WheelEvent;
  contextmenu: Event;
};

const ShadrApp = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<ShadrApplication | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  const debouncedResize = useCallback(() => {
    let frame: number;
    let timeout: NodeJS.Timeout;

    return () => {
      if (timeout) clearTimeout(timeout);
      if (frame) cancelAnimationFrame(frame);

      timeout = setTimeout(() => {
        frame = requestAnimationFrame(() => {
          updateDimensions();
          appRef.current?.handleResize();
        });
      }, 250);
    };
  }, [updateDimensions]);

  useEffect(() => {
    updateDimensions();
    const resizeHandler = debouncedResize();
    const resizeObserver = new ResizeObserver(resizeHandler);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [debouncedResize]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const app = new ShadrApplication({
      width: dimensions.width * (window.devicePixelRatio || 1),
      height: dimensions.height * (window.devicePixelRatio || 1),
    });

    appRef.current = app;

    const handlers: { [K in keyof EventMap]: (e: EventMap[K]) => void } = {
      keydown: (e) => app.handleKeyDown(e),
      keyup: (e) => app.handleKeyUp(e),
      mousemove: (e) => app.handleMouseMove(e),
      mousedown: (e) => app.handleMouseDown(e),
      mouseup: (e) => app.handleMouseUp(e),
      wheel: (e) => app.handleMouseWheel(e),
      contextmenu: (e) => e.preventDefault(),
    };

    (Object.entries(handlers) as [keyof EventMap, (e: Event) => void][]).forEach(
      ([event, handler]) => {
        document.addEventListener(event, handler);
      }
    );

    if (containerRef.current) {
      try {
        containerRef.current.appendChild(app.canvas());
        app.run();
      } catch (e) {
        console.error(e);
      }
    }

    // Cleanup
    return () => {
      (Object.entries(handlers) as [keyof EventMap, (e: Event) => void][]).forEach(
        ([event, handler]) => {
          document.removeEventListener(event, handler);
        }
      );
      app.destroy();
    };
  }, [dimensions]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
};

export default ShadrApp;
