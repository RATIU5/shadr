import { Either, Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import {
  addFrame,
  addNode,
  addWire,
  createGraph,
  removeFrame,
  removeNode,
  type GraphEffect,
  type GraphFrame,
  type GraphNode,
  type GraphSocket,
} from "@shadr/graph-core";
import {
  makeFrameId,
  makeGraphId,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";

type MockTextOptions = Readonly<{
  text?: string;
  style?: Record<string, unknown>;
}>;

vi.mock("pixi.js", () => {
  class Container {
    children: Container[] = [];
    visible = true;
    x = 0;
    y = 0;
    private scaleValue = { x: 1, y: 1 };
    readonly scale = {
      set: (x: number, y?: number): void => {
        this.scaleValue = { x, y: y ?? x };
      },
    };
    readonly position = {
      set: (x: number, y: number): void => {
        this.x = x;
        this.y = y;
      },
    };

    addChild(...children: Container[]): Container {
      this.children.push(...children);
      return children[0] ?? this;
    }

    removeChild(child: Container): void {
      this.children = this.children.filter((entry) => entry !== child);
    }

    removeChildren(): Container[] {
      const removed = [...this.children];
      this.children = [];
      return removed;
    }

    destroy(): void {}
  }

  class Graphics extends Container {
    clear(): void {}
    rect(_x: number, _y: number, _width: number, _height: number): void {}
    circle(_x: number, _y: number, _radius: number): void {}
    poly(_points: ReadonlyArray<number>, _close?: boolean): void {}
    fill(_color: number): void {}
    stroke(
      _options: Readonly<{ width: number; color: number; alpha: number }>,
    ): void {}
    moveTo(_x: number, _y: number): void {}
    bezierCurveTo(
      _cp1x: number,
      _cp1y: number,
      _cp2x: number,
      _cp2y: number,
      _x: number,
      _y: number,
    ): void {}
  }

  class Text extends Container {
    text: string;
    style: Record<string, unknown>;
    readonly anchor = {
      set: (_x: number, _y?: number): void => {},
    };

    constructor(options: MockTextOptions = {}) {
      super();
      this.text = options.text ?? "";
      this.style = { ...(options.style ?? {}) };
    }
  }

  return { Container, Graphics, Text };
});

const { CanvasScene, getWireControlPoints } = await import("@shadr/ui-canvas");

const expectOk = <T>(effect: GraphEffect<T>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected error: ${result.left._tag}`);
  }
  return result.right;
};

const createTestNode = (
  id: string,
  position: Readonly<{ x: number; y: number }>,
): {
  nodeId: ReturnType<typeof makeNodeId>;
  inputId: ReturnType<typeof makeSocketId>;
  outputId: ReturnType<typeof makeSocketId>;
  node: GraphNode;
  sockets: GraphSocket[];
} => {
  const nodeId = makeNodeId(id);
  const inputId = makeSocketId(`${id}.in`);
  const outputId = makeSocketId(`${id}.out`);
  const node: GraphNode = {
    id: nodeId,
    type: "test",
    position,
    params: {},
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
  return { nodeId, inputId, outputId, node, sockets };
};

const bezierPoint = (
  from: Readonly<{ x: number; y: number }>,
  cp1: Readonly<{ x: number; y: number }>,
  cp2: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
  t: number,
): { x: number; y: number } => {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: inv3 * from.x + 3 * inv2 * t * cp1.x + 3 * inv * t2 * cp2.x + t3 * to.x,
    y: inv3 * from.y + 3 * inv2 * t * cp1.y + 3 * inv * t2 * cp2.y + t3 * to.y,
  };
};

describe("CanvasScene", () => {
  it("syncs nodes/frames and updates culling on resync", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", { x: 0, y: 0 });
    const nodeB = createTestNode("B", { x: 400, y: 0 });
    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));

    const frameIn: GraphFrame = {
      id: makeFrameId("frame.in"),
      title: "In",
      position: { x: -60, y: -40 },
      size: { width: 160, height: 120 },
      color: 0x112233,
    };
    const frameOut: GraphFrame = {
      id: makeFrameId("frame.out"),
      title: "Out",
      position: { x: 320, y: -40 },
      size: { width: 160, height: 120 },
      color: 0x223344,
    };
    graph = expectOk(addFrame(graph, frameIn));
    graph = expectOk(addFrame(graph, frameOut));

    const scene = new CanvasScene();
    scene.setViewportSize({ width: 300, height: 200 });
    scene.setCameraCenter({ x: 0, y: 0 });
    scene.syncGraph(graph);

    expect(scene.layers.nodes.children).toHaveLength(2);
    const nodeIn = scene.layers.nodes.children.find(
      (child) => child.x === nodeA.node.position.x,
    );
    const nodeOff = scene.layers.nodes.children.find(
      (child) => child.x === nodeB.node.position.x,
    );
    expect(nodeIn?.visible).toBe(true);
    expect(nodeOff?.visible).toBe(false);

    expect(scene.layers.frames.children).toHaveLength(2);
    const frameInView = scene.layers.frames.children.find(
      (child) => child.x === frameIn.position.x,
    );
    const frameOffscreen = scene.layers.frames.children.find(
      (child) => child.x === frameOut.position.x,
    );
    expect(frameInView?.visible).toBe(true);
    expect(frameOffscreen?.visible).toBe(false);

    graph = expectOk(removeNode(graph, nodeB.nodeId));
    graph = expectOk(removeFrame(graph, frameOut.id));
    scene.syncGraph(graph);

    expect(scene.layers.nodes.children).toHaveLength(1);
    expect(scene.layers.frames.children).toHaveLength(1);
  });

  it("hit tests sockets, wires, and nodes", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", { x: 0, y: -20 });
    const nodeB = createTestNode("B", { x: 400, y: -20 });
    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("wire.AB"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const scene = new CanvasScene();
    scene.setViewportSize({ width: 1000, height: 400 });
    scene.setCameraCenter({ x: 250, y: 0 });
    scene.syncGraph(graph);

    const outputPosition = scene.getSocketPosition(nodeA.outputId);
    expect(outputPosition).not.toBeNull();
    const socketHit = scene.hitTest(scene.worldToScreen(outputPosition!));
    expect(socketHit.kind).toBe("socket");
    if (socketHit.kind === "socket") {
      expect(socketHit.socketId).toBe(nodeA.outputId);
    }

    const inputPosition = scene.getSocketPosition(nodeB.inputId);
    expect(inputPosition).not.toBeNull();
    const { cp1, cp2 } = getWireControlPoints(
      outputPosition!,
      inputPosition!,
    );
    const midPoint = bezierPoint(
      outputPosition!,
      cp1,
      cp2,
      inputPosition!,
      0.5,
    );
    const wireHit = scene.hitTest(scene.worldToScreen(midPoint));
    expect(wireHit.kind).toBe("wire");
    if (wireHit.kind === "wire") {
      expect(wireHit.fromSocketId).toBe(nodeA.outputId);
      expect(wireHit.toSocketId).toBe(nodeB.inputId);
    }

    const nodePoint = {
      x: nodeA.node.position.x + 90,
      y: nodeA.node.position.y + 60,
    };
    const nodeHit = scene.hitTest(scene.worldToScreen(nodePoint));
    expect(nodeHit.kind).toBe("node");
    if (nodeHit.kind === "node") {
      expect(nodeHit.nodeId).toBe(nodeA.nodeId);
    }
  });

  it("culls wires outside the viewport for hit testing", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", { x: 1000, y: 0 });
    const nodeB = createTestNode("B", { x: 1300, y: 0 });
    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("wire.offscreen"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const scene = new CanvasScene();
    scene.setViewportSize({ width: 200, height: 200 });
    scene.setCameraCenter({ x: 0, y: 0 });
    scene.syncGraph(graph);

    const from = scene.getSocketPosition(nodeA.outputId);
    const to = scene.getSocketPosition(nodeB.inputId);
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    const { cp1, cp2 } = getWireControlPoints(from!, to!);
    const midPoint = bezierPoint(from!, cp1, cp2, to!, 0.5);
    const offscreenHit = scene.hitTest(scene.worldToScreen(midPoint));
    expect(offscreenHit.kind).toBe("none");
  });
});
