import tgpu from "typegpu";

export const initCanvas = async (canvas: HTMLCanvasElement) => {
  const root = await tgpu.init();
  const device = root.device;
  const context = canvas.getContext("webgpu") as GPUCanvasContext;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context?.configure({
    device: device,
    format: presentationFormat,
    alphaMode: "premultiplied",
  });
};
