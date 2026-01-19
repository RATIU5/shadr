export type CanvasTheme = Readonly<{
  node: Readonly<{
    fill: number;
    bypassedFill: number;
    stroke: number;
    bypassedStroke: number;
    selectedStroke: number;
    hoveredStroke: number;
    errorStroke: number;
    socketFill: number;
    socketStroke: number;
    socketBypassedFill: number;
    socketBypassedStroke: number;
    headerFill: number;
    headerBypassedFill: number;
    headerText: number;
    headerTextMuted: number;
    badgeError: number;
    badgeBypass: number;
  }>;
  wire: Readonly<{
    defaultColor: number;
  }>;
}>;

export const darkCanvasTheme: CanvasTheme = {
  node: {
    fill: 0x1b1b1f,
    bypassedFill: 0x15151a,
    stroke: 0x3c3c44,
    bypassedStroke: 0x565661,
    selectedStroke: 0x67d0ff,
    hoveredStroke: 0x7fb6ff,
    errorStroke: 0xff6a6a,
    socketFill: 0x101014,
    socketStroke: 0x7b7b86,
    socketBypassedFill: 0x0d0d12,
    socketBypassedStroke: 0x585862,
    headerFill: 0x232734,
    headerBypassedFill: 0x1a1f2b,
    headerText: 0xdce2f0,
    headerTextMuted: 0xa5adbf,
    badgeError: 0xff6a6a,
    badgeBypass: 0x7a7f90,
  },
  wire: {
    defaultColor: 0x4d7cff,
  },
};

export const lightCanvasTheme: CanvasTheme = {
  node: {
    fill: 0xf6f7fb,
    bypassedFill: 0xe9edf3,
    stroke: 0xb6c0cf,
    bypassedStroke: 0x96a1b3,
    selectedStroke: 0x2563eb,
    hoveredStroke: 0x3b82f6,
    errorStroke: 0xdc2626,
    socketFill: 0xf9fafb,
    socketStroke: 0x94a3b8,
    socketBypassedFill: 0xe7ebf1,
    socketBypassedStroke: 0x8a95a6,
    headerFill: 0xe7edf6,
    headerBypassedFill: 0xd8e0ec,
    headerText: 0x1f2937,
    headerTextMuted: 0x4b5563,
    badgeError: 0xdc2626,
    badgeBypass: 0x64748b,
  },
  wire: {
    defaultColor: 0x2563eb,
  },
};
