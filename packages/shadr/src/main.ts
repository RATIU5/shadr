import { Editor } from 'editor';

const editor = new Editor({
  canvas: document.getElementById('node-editor') as HTMLCanvasElement,
  pixiConfig: {
    autoDensity: true,
    antialias: true,
    backgroundColor: 0x1a1b1c,
    resolution: window.devicePixelRatio || 1,
  },
});

editor.start();
