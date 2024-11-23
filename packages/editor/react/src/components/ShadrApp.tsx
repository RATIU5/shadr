import { useEffect, useRef, useState, useCallback } from "react";

const ShadrApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  const debouncedUpdateDimensions = useCallback(() => {
    // Clear any existing timeout
    if (resizeTimeoutRef.current) {
      window.clearTimeout(resizeTimeoutRef.current);
    }

    // Set new timeout
    resizeTimeoutRef.current = window.setTimeout(() => {
      updateDimensions();
    }, 250); // Wait 250ms after last resize event
  }, [updateDimensions]);

  useEffect(() => {
    // Initial size calculation
    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [debouncedUpdateDimensions]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const dpr = window.devicePixelRatio || 1;
      canvas.width = dimensions.width * dpr;
      canvas.height = dimensions.height * dpr;

      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    }
  }, [dimensions]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          display: "block",
        }}
      />
    </div>
  );
};

export default ShadrApp;
