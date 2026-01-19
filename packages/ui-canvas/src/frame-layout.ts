import type { GraphFrame, SocketId } from "@shadr/graph-core";

export const FRAME_TITLE_HEIGHT = 22;
export const FRAME_TITLE_PADDING_X = 10;
export const FRAME_TITLE_PADDING_Y = 6;
export const FRAME_IO_PADDING = 10;
export const FRAME_SOCKET_OFFSET = 8;

export type FrameSocketLayoutItem = Readonly<{
  socketId: SocketId;
  x: number;
  y: number;
}>;

export type FrameSocketLayout = Readonly<{
  inputs: ReadonlyArray<FrameSocketLayoutItem>;
  outputs: ReadonlyArray<FrameSocketLayoutItem>;
}>;

const buildLayout = (
  frame: GraphFrame,
  socketIds: ReadonlyArray<SocketId>,
  x: number,
): FrameSocketLayoutItem[] => {
  if (socketIds.length === 0) {
    return [];
  }
  const availableHeight = Math.max(
    0,
    frame.size.height - FRAME_TITLE_HEIGHT - FRAME_IO_PADDING * 2,
  );
  const spacing =
    socketIds.length > 1 ? availableHeight / (socketIds.length - 1) : 0;
  const startY = FRAME_TITLE_HEIGHT + FRAME_IO_PADDING;
  return socketIds.map((socketId, index) => ({
    socketId,
    x,
    y: startY + spacing * index,
  }));
};

export const getFrameSocketLayout = (
  frame: GraphFrame,
  inputs: ReadonlyArray<SocketId>,
  outputs: ReadonlyArray<SocketId>,
): FrameSocketLayout => ({
  inputs: buildLayout(frame, inputs, FRAME_SOCKET_OFFSET),
  outputs: buildLayout(
    frame,
    outputs,
    Math.max(FRAME_SOCKET_OFFSET, frame.size.width - FRAME_SOCKET_OFFSET),
  ),
});
