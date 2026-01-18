import { Context, Effect, Layer } from "effect";

export type UiEvent = Readonly<{
  kind: "toast";
  title: string;
  description?: string;
}>;

/* eslint-disable no-unused-vars */
export type UiEventServiceApi = Readonly<{
  notify: (_event: UiEvent) => Effect.Effect<void>;
}>;
/* eslint-enable no-unused-vars */

export class UiEventService extends Context.Tag("UiEventService")<
  UiEventService,
  UiEventServiceApi
>() {}

export const UiEventServiceLive = Layer.succeed(UiEventService, {
  notify: () => Effect.void,
});

/* eslint-disable no-unused-vars */
export const createUiEventServiceLayer = (
  notify: (_event: UiEvent) => void,
): Layer.Layer<never, never, UiEventServiceApi> =>
  Layer.succeed(UiEventService, {
    notify: (event) => Effect.sync(() => notify(event)),
  });
/* eslint-enable no-unused-vars */

export const notifyUi = (event: UiEvent): Effect.Effect<void> =>
  Effect.flatMap(UiEventService, (service) => service.notify(event));
