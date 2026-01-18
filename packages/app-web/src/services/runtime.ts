import { Effect, Layer } from "effect";

import { ExecServiceLive } from "~/services/exec-service";
import { GraphServiceLive } from "~/services/graph-service";
import { StorageServiceLive } from "~/services/storage-service";
import {
  type UiEventServiceApi,
  UiEventServiceLive,
} from "~/services/ui-event-service";

const baseLayer = Layer.mergeAll(
  GraphServiceLive,
  ExecServiceLive,
  StorageServiceLive,
);
const defaultLayer = Layer.mergeAll(baseLayer, UiEventServiceLive);

export const createAppLayer = (
  uiEventLayer?: Layer.Layer<never, never, UiEventServiceApi>,
): typeof defaultLayer =>
  uiEventLayer ? Layer.mergeAll(baseLayer, uiEventLayer) : defaultLayer;

export const runAppEffect = <A, E>(
  effect: Effect.Effect<A, E>,
  layer = defaultLayer,
): Promise<A> => Effect.runPromise(Effect.provide(effect, layer));

export const runAppEffectEither = <A, E>(
  effect: Effect.Effect<A, E>,
  layer = defaultLayer,
): Promise<Effect.Either<E, A>> => runAppEffect(Effect.either(effect), layer);

export const runAppEffectSync = <A, E>(
  effect: Effect.Effect<A, E>,
  layer = defaultLayer,
): A => Effect.runSync(Effect.provide(effect, layer));

export const runAppEffectSyncEither = <A, E>(
  effect: Effect.Effect<A, E>,
  layer = defaultLayer,
): Effect.Either<E, A> => runAppEffectSync(Effect.either(effect), layer);
