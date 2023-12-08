import { emit } from "../events/event-bus";

export type ContextItem = {
  type: "item" | "separator";
  label?: string;
  action?: () => void;
  disabled?: boolean;
  items?: ContextItem[];
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

export type EditorState = {
  contextMenu: ContextItem[];
  zoomFactor: number;
  zoomSensitivity: number;
  interaction: {
    dragIsDown: boolean;
    mousePos: number[];
    dragOffset: {
      x: number;
      y: number;
    };
    dragStart: {
      x: number;
      y: number;
    };
    zoom: number;
  };
};

const state: EditorState = {
  contextMenu: [
    {
      type: "item",
      label: "Add new node",
      items: [
        {
          type: "item",
          label: "Input&nbsp;node",
          action: () => console.log("i"),
        },
        {
          type: "item",
          label: "Output&nbsp;node",
          action: () => console.log("o"),
        },
      ],
    },
    {
      type: "item",
      label: "Select all",
      action: () => console.log("a"),
      disabled: true,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Zoom in",
      action: () => {
        setZoom(getZoom() - 0.5);
        emit("grid:zoom", state.zoomFactor);
      },
    },
    {
      type: "item",
      label: "Zoom out",
      action: () => {
        setZoom(getZoom() + 0.5);
        emit("grid:zoom", state.zoomFactor);
      },
    },
    {
      type: "item",
      label: "Reset view",
      action: () => {
        state.interaction.dragOffset = { x: 0, y: 0 };
        setZoom(1);
        emit("grid:zoom", state.zoomFactor);
        emit("grid:drag", [0, 0]);
      },
    },
  ],
  zoomFactor: 1.0,
  zoomSensitivity: 0.05,
  interaction: {
    dragIsDown: false,
    mousePos: [0, 0],
    dragOffset: {
      x: 0,
      y: 0,
    },
    dragStart: {
      x: 0,
      y: 0,
    },
    zoom: 1.0,
  },
};

export function setZoom(value: number) {
  state.zoomFactor = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}
export function getZoom() {
  return state.zoomFactor;
}

export function getContextMenu() {
  return state.contextMenu;
}

export function getZoomSensitivity() {
  return state.zoomSensitivity;
}

export function getInteraction() {
  return state.interaction;
}
