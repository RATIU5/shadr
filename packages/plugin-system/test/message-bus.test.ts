import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createMessageBus } from "../src/message-bus.js";

type TestEvents = {
  "node.created": { id: string };
  "graph.executed": { total: number };
};

describe("message bus", () => {
  it("publishes to synchronous handlers in registration order", () => {
    const bus = createMessageBus<TestEvents>();
    const calls: string[] = [];

    Effect.runSync(
      bus.subscribe("node.created", (payload) =>
        Effect.sync(() => {
          calls.push(`first:${payload.id}`);
        }),
      ),
    );

    Effect.runSync(
      bus.subscribe("node.created", (payload) =>
        Effect.sync(() => {
          calls.push(`second:${payload.id}`);
        }),
      ),
    );

    Effect.runSync(bus.publish("node.created", { id: "a" }));

    expect(calls).toEqual(["first:a", "second:a"]);
  });

  it("supports unsubscribe for synchronous handlers", () => {
    const bus = createMessageBus<TestEvents>();
    const calls: string[] = [];

    const unsubscribe = Effect.runSync(
      bus.subscribe("graph.executed", (payload) =>
        Effect.sync(() => {
          calls.push(`run:${payload.total}`);
        }),
      ),
    );

    Effect.runSync(bus.publish("graph.executed", { total: 3 }));
    unsubscribe();
    Effect.runSync(bus.publish("graph.executed", { total: 5 }));

    expect(calls).toEqual(["run:3"]);
  });

  it("defers handler execution until flushed", () => {
    const bus = createMessageBus<TestEvents>();
    const calls: string[] = [];

    Effect.runSync(
      bus.subscribeDeferred("node.created", (payload) =>
        Effect.sync(() => {
          calls.push(`deferred:${payload.id}`);
        }),
      ),
    );

    Effect.runSync(bus.publishDeferred("node.created", { id: "b" }));

    expect(calls).toEqual([]);

    Effect.runSync(bus.flushDeferred());

    expect(calls).toEqual(["deferred:b"]);
  });
});
