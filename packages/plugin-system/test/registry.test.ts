import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createMessageBus } from "../src/message-bus.js";
import { createPluginRegistry } from "../src/registry.js";
import type { NodeDefinition, PluginDefinition } from "../src/types.js";

const createContext = () => ({
  bus: createMessageBus<Record<string, never>>(),
  graph: {
    getGraph: () => Effect.succeed(null),
    updateGraph: (updater: (graph: null) => Effect.Effect<null, unknown>) =>
      updater(null),
  },
});

const baseNode = (overrides: Partial<NodeDefinition>): NodeDefinition => ({
  typeId: "base",
  label: "Base",
  description: "Base node for tests.",
  inputs: [],
  outputs: [
    {
      key: "out",
      label: "Out",
      dataType: "float",
      direction: "output",
    },
  ],
  compute: () => ({ out: null }),
  ...overrides,
});

const createPlugin = (
  nodes: ReadonlyArray<NodeDefinition>,
): PluginDefinition<Record<string, never>, null, unknown> => ({
  id: "test-plugin",
  name: "Test Plugin",
  version: "0.0.0",
  nodes,
});

describe("plugin registry node definition validation", () => {
  it("rejects duplicate input keys", () => {
    const registry = createPluginRegistry<
      Record<string, never>,
      null,
      unknown
    >();
    const node = baseNode({
      typeId: "dup-input",
      inputs: [
        {
          key: "value",
          label: "Value",
          dataType: "float",
          direction: "input",
        },
        {
          key: "value",
          label: "Value 2",
          dataType: "float",
          direction: "input",
        },
      ],
    });

    const result = Effect.runSync(
      Effect.either(
        registry.registerPlugin(createPlugin([node]), createContext()),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toEqual({
        _tag: "InvalidNodeDefinition",
        nodeType: "dup-input",
        issue: { _tag: "DuplicateInputKey", key: "value" },
      });
    }
  });

  it("rejects unknown socket types", () => {
    const registry = createPluginRegistry<
      Record<string, never>,
      null,
      unknown
    >();
    const node = baseNode({
      typeId: "unknown-socket",
      inputs: [
        {
          key: "value",
          label: "Value",
          dataType: "custom-type",
          direction: "input",
        },
      ],
    });

    const result = Effect.runSync(
      Effect.either(
        registry.registerPlugin(createPlugin([node]), createContext()),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toEqual({
        _tag: "InvalidNodeDefinition",
        nodeType: "unknown-socket",
        issue: {
          _tag: "UnknownSocketType",
          socketKey: "value",
          socketTypeId: "custom-type",
        },
      });
    }
  });

  it("rejects unknown param schemas", () => {
    const registry = createPluginRegistry<
      Record<string, never>,
      null,
      unknown
    >();
    const node = baseNode({
      typeId: "unknown-schema",
      paramSchemaId: "missing-schema",
    });

    const result = Effect.runSync(
      Effect.either(
        registry.registerPlugin(createPlugin([node]), createContext()),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toEqual({
        _tag: "InvalidNodeDefinition",
        nodeType: "unknown-schema",
        issue: { _tag: "UnknownParamSchema", schemaId: "missing-schema" },
      });
    }
  });
});
