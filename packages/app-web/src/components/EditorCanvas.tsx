import type { GraphSocket, NodeId, SocketId, WireId } from "@shadr/graph-core";
import type { JsonValue } from "@shadr/shared";
import {
  isSocketTypeCompatible,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";
import { CanvasScene, defaultNodeLayout, getNodeSize } from "@shadr/ui-canvas";
import * as PIXI from "pixi.js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import {
  createMoveNodesCommand,
  createRemoveNodeCommand,
  createRemoveWireCommand,
  isNoopCommand,
} from "~/editor/history";
import {
  createDefaultParams,
  getNodeCatalogEntry,
} from "~/editor/node-catalog";
import type { EditorStore } from "~/editor/store";

type Point = Readonly<{ x: number; y: number }>;
type WireHoverStatus = "neutral" | "valid" | "invalid";
type SocketTooltip = Readonly<{
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  valueLabel: string;
}>;

type DragState =
  | { kind: "none" }
  | {
      kind: "drag-nodes";
      origin: Point;
      startPositions: Map<NodeId, Point>;
    }
  | {
      kind: "marquee";
      origin: Point;
      current: Point;
      additive: boolean;
    }
  | {
      kind: "wire";
      fromSocketId: SocketId;
      fromPosition: Point;
      current: Point;
    };

type EditorCanvasProps = Readonly<{
  store: EditorStore;
}>;

export default function EditorCanvas(props: EditorCanvasProps) {
  let container: HTMLDivElement | undefined;
  let app: PIXI.Application | null = null;
  let scene: CanvasScene | null = null;
  let dragState: DragState = { kind: "none" };

  const {
    graph,
    dirtyState,
    selectedNodes,
    selectedWires,
    applyGraphCommand,
    applyGraphCommandTransient,
    recordGraphCommand,
    beginHistoryBatch,
    commitHistoryBatch,
    refreshActiveOutput,
    clearSelection,
    setNodeSelection,
    setWireSelection,
    undo,
    redo,
  } = props.store;

  let graphSnapshot = graph();
  let dirtyStateSnapshot = dirtyState();
  let selectedNodesSnapshot = selectedNodes();
  let selectedWiresSnapshot = selectedWires();
  let nodeCounter = 1;
  let wireCounter = 1;
  const [socketTooltip, setSocketTooltip] = createSignal<SocketTooltip | null>(
    null,
  );

  const syncScene = (): void => {
    scene?.syncGraph(graphSnapshot, {
      selectedNodes: selectedNodesSnapshot,
      selectedWires: selectedWiresSnapshot,
    });
  };

  const addNodeAt = (position: Point): void => {
    const baseId = `node-${nodeCounter}`;
    nodeCounter += 1;
    const nodeId = makeNodeId(baseId);
    const inputId = makeSocketId(`${baseId}.in`);
    const outputId = makeSocketId(`${baseId}.out`);
    const node = {
      id: nodeId,
      type: "basic",
      position,
      params: createDefaultParams(getNodeCatalogEntry("basic")?.paramSchema),
      inputs: [inputId],
      outputs: [outputId],
    };
    const sockets: GraphSocket[] = [
      {
        id: inputId,
        nodeId,
        name: "in",
        direction: "input",
        dataType: "float",
        required: false,
      },
      {
        id: outputId,
        nodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ];
    if (applyGraphCommand({ kind: "add-node", node, sockets })) {
      setNodeSelection(new Set([nodeId]));
    }
  };

  const disconnectInputSocket = (socketId: SocketId): void => {
    const wiresToRemove: WireId[] = [];
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.toSocketId === socketId) {
        wiresToRemove.push(wire.id);
      }
    }
    if (wiresToRemove.length > 0) {
      beginHistoryBatch("disconnect-input");
      let changed = false;
      for (const wireId of wiresToRemove) {
        const command = createRemoveWireCommand(graphSnapshot, wireId);
        if (!command) {
          continue;
        }
        if (applyGraphCommandTransient(command)) {
          recordGraphCommand(command);
          changed = true;
        }
      }
      commitHistoryBatch();
      setWireSelection(new Set<WireId>());
      if (changed) {
        refreshActiveOutput();
      }
    }
  };

  const getScreenPoint = (event: PointerEvent): Point => {
    const view = app?.view;
    if (!view) {
      return { x: event.clientX, y: event.clientY };
    }
    const rect = view.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const updateMarquee = (
    graphics: PIXI.Graphics,
    origin: Point,
    current: Point,
  ): void => {
    graphics.clear();
    const minX = Math.min(origin.x, current.x);
    const minY = Math.min(origin.y, current.y);
    const maxX = Math.max(origin.x, current.x);
    const maxY = Math.max(origin.y, current.y);
    graphics.rect(minX, minY, maxX - minX, maxY - minY);
    graphics.stroke({ width: 1, color: 0x4fb3ff, alpha: 1 });
    graphics.fill({ color: 0x4fb3ff, alpha: 0.1 });
  };

  const getInputConnectionCount = (socketId: SocketId): number => {
    let count = 0;
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.toSocketId === socketId) {
        count += 1;
      }
    }
    return count;
  };

  const formatValue = (value: JsonValue | null): string => {
    if (value === null) {
      return "null";
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "string") {
      return `"${value}"`;
    }
    return JSON.stringify(value);
  };

  const getCachedOutputValue = (
    socket: GraphSocket,
  ): JsonValue | null | undefined => {
    const outputs = dirtyStateSnapshot.outputCache.get(socket.nodeId);
    if (
      !outputs ||
      !Object.prototype.hasOwnProperty.call(outputs, socket.name)
    ) {
      return undefined;
    }
    return outputs[socket.name] ?? null;
  };

  const findInputWire = (socketId: SocketId): WireId | null => {
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.toSocketId === socketId) {
        return wire.id;
      }
    }
    return null;
  };

  const buildSocketTooltip = (
    socketId: SocketId,
    screenPoint: Point,
  ): SocketTooltip | null => {
    const socket = graphSnapshot.sockets.get(socketId);
    if (!socket) {
      return null;
    }
    const title = `${socket.direction === "input" ? "Input" : "Output"}: ${
      socket.name
    }`;
    const typeLabel = `Type: ${socket.dataType}`;
    let valueLabel = "Value: No cached value";

    if (socket.direction === "output") {
      const cached = getCachedOutputValue(socket);
      if (cached !== undefined) {
        valueLabel = `Value: ${formatValue(cached)}`;
      }
    } else {
      const inputWireId = findInputWire(socket.id);
      if (!inputWireId) {
        valueLabel = "Value: Unconnected";
      } else {
        const wire = graphSnapshot.wires.get(inputWireId);
        const fromSocket = wire
          ? graphSnapshot.sockets.get(wire.fromSocketId)
          : null;
        if (fromSocket) {
          const cached = getCachedOutputValue(fromSocket);
          if (cached !== undefined) {
            valueLabel = `Value: ${formatValue(cached)}`;
          }
        }
      }
    }

    return {
      x: screenPoint.x + 12,
      y: screenPoint.y + 12,
      title,
      typeLabel,
      valueLabel,
    };
  };

  const wouldCreateCycle = (fromNodeId: NodeId, toNodeId: NodeId): boolean => {
    if (fromNodeId === toNodeId) {
      return true;
    }
    const stack: NodeId[] = [toNodeId];
    const visited = new Set<NodeId>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      if (current === fromNodeId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = graphSnapshot.outgoing.get(current);
      if (!neighbors) {
        continue;
      }
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return false;
  };

  const getWireHoverStatus = (
    fromSocketId: SocketId,
    hit: ReturnType<CanvasScene["hitTest"]>,
  ): {
    status: WireHoverStatus;
    targetPosition: Point | null;
    targetSocketId: SocketId | null;
  } => {
    if (hit.kind !== "socket") {
      return { status: "neutral", targetPosition: null, targetSocketId: null };
    }
    const fromSocket = graphSnapshot.sockets.get(fromSocketId);
    const toSocket = graphSnapshot.sockets.get(hit.socketId);
    if (!fromSocket || !toSocket) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: null,
      };
    }
    if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (fromSocket.nodeId === toSocket.nodeId) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (getInputConnectionCount(toSocket.id) >= 1) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (wouldCreateCycle(fromSocket.nodeId, toSocket.nodeId)) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    return {
      status: "valid",
      targetPosition: hit.position,
      targetSocketId: toSocket.id,
    };
  };

  const getWireColor = (status: WireHoverStatus): number => {
    switch (status) {
      case "valid":
        return 0x45d188;
      case "invalid":
        return 0xff6b6b;
      default:
        return 0x7bf1ff;
    }
  };

  const updateGhostWire = (
    graphics: PIXI.Graphics,
    from: Point,
    to: Point,
    status: WireHoverStatus,
  ): void => {
    graphics.clear();
    graphics.moveTo(from.x, from.y);
    graphics.lineTo(to.x, to.y);
    graphics.stroke({ width: 2, color: getWireColor(status), alpha: 0.7 });
  };

  const updateSocketHover = (
    graphics: PIXI.Graphics,
    position: Point | null,
    status: WireHoverStatus,
  ): void => {
    graphics.clear();
    if (!position) {
      graphics.visible = false;
      return;
    }
    graphics.visible = true;
    const color = getWireColor(status);
    graphics.circle(position.x, position.y, 12);
    graphics.stroke({ width: 2, color, alpha: 0.9 });
    graphics.fill({ color, alpha: 0.2 });
  };

  onMount(() => {
    if (!container) {
      return;
    }

    app = new PIXI.Application({
      background: "#0d0f14",
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      resizeTo: container,
    });

    container.appendChild(app.view);
    app.view.style.display = "block";

    scene = new CanvasScene({ layout: defaultNodeLayout });
    scene.attachTo(app.stage);
    scene.setViewportSize(
      { width: container.clientWidth, height: container.clientHeight },
      { pixelRatio: window.devicePixelRatio },
    );

    const ghostWire = new PIXI.Graphics();
    const socketHover = new PIXI.Graphics();
    const marquee = new PIXI.Graphics();
    ghostWire.visible = false;
    socketHover.visible = false;
    marquee.visible = false;
    scene.layers.overlays.addChild(ghostWire);
    scene.layers.overlays.addChild(socketHover);
    scene.layers.overlays.addChild(marquee);

    syncScene();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !scene) {
        return;
      }
      const { width, height } = entry.contentRect;
      scene.setViewportSize(
        { width, height },
        { pixelRatio: window.devicePixelRatio },
      );
      syncScene();
    });
    resizeObserver.observe(container);

    const onPointerDown = (event: PointerEvent): void => {
      if (!scene || event.button !== 0 || !app) {
        return;
      }
      const screenPoint = getScreenPoint(event);
      const hit = scene.hitTest(screenPoint);
      const worldPoint = scene.screenToWorld(screenPoint);
      setSocketTooltip(null);

      if (hit.kind === "socket") {
        const socket = graphSnapshot.sockets.get(hit.socketId);
        if (socket?.direction === "output") {
          ghostWire.visible = true;
          updateGhostWire(ghostWire, hit.position, worldPoint, "neutral");
          dragState = {
            kind: "wire",
            fromSocketId: socket.id,
            fromPosition: hit.position,
            current: worldPoint,
          };
          app.view.setPointerCapture(event.pointerId);
          return;
        }
        if (socket?.direction === "input") {
          disconnectInputSocket(socket.id);
          return;
        }
      }

      if (hit.kind === "node") {
        const next = new Set(selectedNodesSnapshot);
        if (event.shiftKey) {
          if (next.has(hit.nodeId)) {
            next.delete(hit.nodeId);
          } else {
            next.add(hit.nodeId);
          }
        } else if (!next.has(hit.nodeId)) {
          next.clear();
          next.add(hit.nodeId);
        }
        setNodeSelection(next);
        if (!next.has(hit.nodeId)) {
          dragState = { kind: "none" };
          return;
        }
        const startPositions = new Map<NodeId, Point>();
        for (const nodeId of next) {
          const node = graphSnapshot.nodes.get(nodeId);
          if (node) {
            startPositions.set(nodeId, { ...node.position });
          }
        }
        dragState = {
          kind: "drag-nodes",
          origin: worldPoint,
          startPositions,
        };
        app.view.setPointerCapture(event.pointerId);
        return;
      }

      if (hit.kind === "wire") {
        const next = new Set<WireId>();
        next.add(hit.wireId);
        setWireSelection(next);
        return;
      }

      clearSelection();
      marquee.visible = true;
      updateMarquee(marquee, worldPoint, worldPoint);
      dragState = {
        kind: "marquee",
        origin: worldPoint,
        current: worldPoint,
        additive: event.shiftKey,
      };
      app.view.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!scene) {
        return;
      }
      const screenPoint = getScreenPoint(event);
      const worldPoint = scene.screenToWorld(screenPoint);

      if (dragState.kind === "drag-nodes") {
        setSocketTooltip(null);
        const delta = {
          x: worldPoint.x - dragState.origin.x,
          y: worldPoint.y - dragState.origin.y,
        };
        const beforeUpdates = Array.from(
          dragState.startPositions.entries(),
        ).map(([nodeId, start]) => {
          const current = graphSnapshot.nodes.get(nodeId)?.position ?? start;
          return {
            nodeId,
            position: { x: current.x, y: current.y },
          };
        });
        const afterUpdates = Array.from(dragState.startPositions.entries()).map(
          ([nodeId, start]) => ({
            nodeId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }),
        );
        applyGraphCommandTransient(
          createMoveNodesCommand(beforeUpdates, afterUpdates),
        );
        return;
      }

      if (dragState.kind === "marquee") {
        setSocketTooltip(null);
        dragState = { ...dragState, current: worldPoint };
        updateMarquee(marquee, dragState.origin, worldPoint);
        return;
      }

      if (dragState.kind === "wire") {
        const hit = scene.hitTest(screenPoint);
        const hover = getWireHoverStatus(dragState.fromSocketId, hit);
        const targetPosition = hover.targetPosition ?? worldPoint;
        dragState = { ...dragState, current: targetPosition };
        updateGhostWire(
          ghostWire,
          dragState.fromPosition,
          targetPosition,
          hover.status,
        );
        updateSocketHover(socketHover, hover.targetPosition, hover.status);
        setSocketTooltip(null);
        return;
      }

      if (dragState.kind === "none") {
        const hit = scene.hitTest(screenPoint);
        if (hit.kind === "socket") {
          setSocketTooltip(buildSocketTooltip(hit.socketId, screenPoint));
        } else {
          setSocketTooltip(null);
        }
      }
    };

    const selectNodesInMarquee = (
      origin: Point,
      current: Point,
      additive: boolean,
    ): void => {
      const minX = Math.min(origin.x, current.x);
      const minY = Math.min(origin.y, current.y);
      const maxX = Math.max(origin.x, current.x);
      const maxY = Math.max(origin.y, current.y);
      const next = additive
        ? new Set(selectedNodesSnapshot)
        : new Set<NodeId>();
      for (const node of graphSnapshot.nodes.values()) {
        const { width, height } = getNodeSize(node, defaultNodeLayout);
        const nodeMinX = node.position.x;
        const nodeMinY = node.position.y;
        const nodeMaxX = node.position.x + width;
        const nodeMaxY = node.position.y + height;
        const intersects =
          nodeMaxX >= minX &&
          nodeMinX <= maxX &&
          nodeMaxY >= minY &&
          nodeMinY <= maxY;
        if (intersects) {
          next.add(node.id);
        }
      }
      setNodeSelection(next);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (!scene || !app) {
        return;
      }
      const screenPoint = getScreenPoint(event);
      if (dragState.kind === "marquee") {
        marquee.clear();
        marquee.visible = false;
        selectNodesInMarquee(
          dragState.origin,
          dragState.current,
          dragState.additive,
        );
        dragState = { kind: "none" };
        return;
      }

      if (dragState.kind === "wire") {
        ghostWire.clear();
        ghostWire.visible = false;
        socketHover.clear();
        socketHover.visible = false;
        const hit = scene.hitTest(screenPoint);
        const hover = getWireHoverStatus(dragState.fromSocketId, hit);
        if (hover.status === "valid" && hover.targetSocketId) {
          const wireId = makeWireId(`wire-${wireCounter}`);
          wireCounter += 1;
          const connected = applyGraphCommand({
            kind: "add-wire",
            wire: {
              id: wireId,
              fromSocketId: dragState.fromSocketId,
              toSocketId: hover.targetSocketId,
            },
          });
          if (connected) {
            setWireSelection(new Set([wireId]));
          }
        }
        dragState = { kind: "none" };
        return;
      }

      if (dragState.kind === "drag-nodes") {
        const beforeUpdates = Array.from(
          dragState.startPositions.entries(),
        ).map(([nodeId, start]) => ({
          nodeId,
          position: { x: start.x, y: start.y },
        }));
        const afterUpdates = Array.from(dragState.startPositions.entries()).map(
          ([nodeId, start]) => {
            const position = graphSnapshot.nodes.get(nodeId)?.position ?? start;
            return {
              nodeId,
              position: { x: position.x, y: position.y },
            };
          },
        );
        const command = createMoveNodesCommand(beforeUpdates, afterUpdates);
        if (!isNoopCommand(command)) {
          recordGraphCommand(command);
        }
        dragState = { kind: "none" };
        setSocketTooltip(null);
        return;
      }

      if (dragState.kind === "none") {
        return;
      }
    };

    const onDoubleClick = (event: MouseEvent): void => {
      if (!scene) {
        return;
      }
      const rect = app?.view.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const worldPoint = scene.screenToWorld(screenPoint);
      addNodeAt(worldPoint);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (event.key === "Escape") {
        clearSelection();
        ghostWire.clear();
        ghostWire.visible = false;
        socketHover.clear();
        socketHover.visible = false;
        marquee.clear();
        marquee.visible = false;
        setSocketTooltip(null);
        dragState = { kind: "none" };
        return;
      }

      if (isEditableTarget) {
        return;
      }

      const isUndo =
        event.key.toLowerCase() === "z" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey;
      const isRedo =
        (event.key.toLowerCase() === "z" &&
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey) ||
        (event.key.toLowerCase() === "y" && (event.metaKey || event.ctrlKey));

      if (isUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (isRedo) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        if (
          selectedNodesSnapshot.size === 0 &&
          selectedWiresSnapshot.size === 0
        ) {
          return;
        }
        event.preventDefault();
        const nodeCommands = Array.from(selectedNodesSnapshot)
          .map((nodeId) => createRemoveNodeCommand(graphSnapshot, nodeId))
          .filter(
            (command): command is NonNullable<typeof command> => !!command,
          );
        const removedWireIds = new Set<WireId>();
        for (const command of nodeCommands) {
          if (command.kind !== "remove-node") {
            continue;
          }
          for (const wire of command.wires) {
            removedWireIds.add(wire.id);
          }
        }
        const wireCommands = Array.from(selectedWiresSnapshot)
          .filter((wireId) => !removedWireIds.has(wireId))
          .map((wireId) => createRemoveWireCommand(graphSnapshot, wireId))
          .filter(
            (command): command is NonNullable<typeof command> => !!command,
          );
        const commands = [...nodeCommands, ...wireCommands];
        if (commands.length === 0) {
          return;
        }
        beginHistoryBatch("delete-selection");
        let changed = false;
        for (const command of commands) {
          if (applyGraphCommandTransient(command)) {
            recordGraphCommand(command);
            changed = true;
          }
        }
        commitHistoryBatch();
        clearSelection();
        if (changed) {
          refreshActiveOutput();
        }
      }
    };

    const onPointerLeave = (): void => {
      ghostWire.clear();
      ghostWire.visible = false;
      socketHover.clear();
      socketHover.visible = false;
      marquee.clear();
      marquee.visible = false;
      setSocketTooltip(null);
      dragState = { kind: "none" };
    };

    app.view.addEventListener("pointerdown", onPointerDown);
    app.view.addEventListener("pointermove", onPointerMove);
    app.view.addEventListener("pointerup", onPointerUp);
    app.view.addEventListener("pointerleave", onPointerLeave);
    app.view.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKeyDown);

    onCleanup(() => {
      app?.view.removeEventListener("pointerdown", onPointerDown);
      app?.view.removeEventListener("pointermove", onPointerMove);
      app?.view.removeEventListener("pointerup", onPointerUp);
      app?.view.removeEventListener("pointerleave", onPointerLeave);
      app?.view.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      app?.destroy(true);
      app = null;
      scene = null;
    });
  });

  createEffect(() => {
    graphSnapshot = graph();
    dirtyStateSnapshot = dirtyState();
    selectedNodesSnapshot = selectedNodes();
    selectedWiresSnapshot = selectedWires();
    syncScene();
  });

  return (
    <div class="canvas-view" ref={container}>
      {socketTooltip() ? (
        <div
          class="socket-tooltip"
          style={{
            left: `${socketTooltip()!.x}px`,
            top: `${socketTooltip()!.y}px`,
          }}
        >
          <div class="socket-tooltip-title">{socketTooltip()!.title}</div>
          <div class="socket-tooltip-row">{socketTooltip()!.typeLabel}</div>
          <div class="socket-tooltip-value">{socketTooltip()!.valueLabel}</div>
        </div>
      ) : null}
    </div>
  );
}
