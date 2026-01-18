import { Effect } from "effect";

import type { EventMap, PluginMessageBus } from "./types.js";

type EventHandler<Events extends EventMap, EventKey extends keyof Events> = (
  // eslint-disable-next-line no-unused-vars
  payload: Events[EventKey],
) => Effect.Effect<void>;

type AnyEventHandler<Events extends EventMap> = (
  // eslint-disable-next-line no-unused-vars
  payload: Events[keyof Events],
) => Effect.Effect<void>;

type DeferredEvent<Events extends EventMap> = Readonly<{
  event: keyof Events;
  payload: Events[keyof Events];
}>;

const runHandlers = <Events extends EventMap, EventKey extends keyof Events>(
  handlers: ReadonlyArray<EventHandler<Events, EventKey>>,
  payload: Events[EventKey],
): Effect.Effect<void> =>
  handlers.reduce(
    (effect, handler) => Effect.flatMap(effect, () => handler(payload)),
    Effect.void,
  );

const getHandlersSnapshot = <
  Events extends EventMap,
  EventKey extends keyof Events,
>(
  map: Map<keyof Events, Array<AnyEventHandler<Events>>>,
  event: EventKey,
): ReadonlyArray<EventHandler<Events, EventKey>> => {
  const handlers = map.get(event);
  if (!handlers || handlers.length === 0) {
    return [];
  }
  return [...handlers] as ReadonlyArray<EventHandler<Events, EventKey>>;
};

const addHandler = <Events extends EventMap, EventKey extends keyof Events>(
  map: Map<keyof Events, Array<AnyEventHandler<Events>>>,
  event: EventKey,
  handler: EventHandler<Events, EventKey>,
): (() => void) => {
  const handlers = map.get(event);
  if (handlers) {
    handlers.push(handler as AnyEventHandler<Events>);
  } else {
    map.set(event, [handler as AnyEventHandler<Events>]);
  }

  return () => {
    const currentHandlers = map.get(event);
    if (!currentHandlers) {
      return;
    }
    const nextHandlers = currentHandlers.filter(
      (existing) => existing !== handler,
    );
    if (nextHandlers.length === 0) {
      map.delete(event);
    } else {
      map.set(event, nextHandlers);
    }
  };
};

export const createMessageBus = <
  Events extends EventMap,
>(): PluginMessageBus<Events> => {
  const immediateHandlers = new Map<
    keyof Events,
    Array<AnyEventHandler<Events>>
  >();
  const deferredHandlers = new Map<
    keyof Events,
    Array<AnyEventHandler<Events>>
  >();
  const deferredQueue: Array<DeferredEvent<Events>> = [];

  const publish = <EventKey extends keyof Events>(
    event: EventKey,
    payload: Events[EventKey],
  ): Effect.Effect<void> =>
    Effect.flatMap(
      Effect.sync(() => getHandlersSnapshot(immediateHandlers, event)),
      (handlers) => runHandlers(handlers, payload),
    );

  const publishDeferred = <EventKey extends keyof Events>(
    event: EventKey,
    payload: Events[EventKey],
  ): Effect.Effect<void> =>
    Effect.sync(() => {
      deferredQueue.push({
        event,
        payload,
      } as DeferredEvent<Events>);
    });

  const subscribe = <EventKey extends keyof Events>(
    event: EventKey,
    handler: EventHandler<Events, EventKey>,
  ): Effect.Effect<() => void> =>
    Effect.sync(() => addHandler(immediateHandlers, event, handler));

  const subscribeDeferred = <EventKey extends keyof Events>(
    event: EventKey,
    handler: EventHandler<Events, EventKey>,
  ): Effect.Effect<() => void> =>
    Effect.sync(() => addHandler(deferredHandlers, event, handler));

  const flushDeferred = (): Effect.Effect<void> =>
    Effect.flatMap(
      Effect.sync(() => deferredQueue.splice(0, deferredQueue.length)),
      (queued) =>
        queued.reduce(
          (effect, entry) =>
            Effect.flatMap(effect, () =>
              Effect.flatMap(
                Effect.sync(() =>
                  getHandlersSnapshot(
                    deferredHandlers,
                    entry.event as keyof Events,
                  ),
                ),
                (handlers) =>
                  runHandlers(
                    handlers as ReadonlyArray<
                      EventHandler<Events, keyof Events>
                    >,
                    entry.payload as Events[keyof Events],
                  ),
              ),
            ),
          Effect.void,
        ),
    );

  return {
    publish,
    publishDeferred,
    subscribe,
    subscribeDeferred,
    flushDeferred,
  };
};
