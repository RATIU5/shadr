import { emit } from "../events/event-bus";

export type ContextItem = {
  type: "item" | "separator";
  label?: string;
  action?: () => void;
  disabled?: boolean;
  items?: ContextItem[];
};

export type EditorState = {
  contextMenu: ContextItem[];
  zoomFactor: number;
  zoomSensitivity: number;
  minZoom: number;
  maxZoom: number;
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

export const state: EditorState = {
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
        state.zoomFactor -= 0.5;
        emit("grid:zoom", state.zoomFactor);
      },
    },
    {
      type: "item",
      label: "Zoom out",
      action: () => {
        state.zoomFactor += 0.5;
        emit("grid:zoom", state.zoomFactor);
      },
    },
    {
      type: "item",
      label: "Reset view",
      action: () => {
        state.interaction.dragOffset = { x: 0, y: 0 };
        state.zoomFactor = 1;
        emit("grid:zoom", state.zoomFactor);
        emit("grid:drag", [0, 0]);
      },
    },
  ],
  zoomFactor: 1.0,
  zoomSensitivity: 0.1,
  minZoom: 0.5,
  maxZoom: 5.0,
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
