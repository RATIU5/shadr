import type { Either } from "effect";
import { Effect, Layer } from "effect";

import { type ExecService, ExecServiceLive } from "~/services/exec-service";
import { type GraphService, GraphServiceLive } from "~/services/graph-service";
import {
  type StorageService,
  StorageServiceLive,
} from "~/services/storage-service";
import {
  type UiEventService,
  UiEventServiceLive,
} from "~/services/ui-event-service";

type CoreServiceTags = ExecService | GraphService | StorageService;
type AppServiceTags = CoreServiceTags | UiEventService;

const baseLayer: Layer.Layer<CoreServiceTags> = Layer.mergeAll(
  GraphServiceLive,
  ExecServiceLive,
  StorageServiceLive,
);
const defaultLayer: Layer.Layer<AppServiceTags> = Layer.mergeAll(
  baseLayer,
  UiEventServiceLive,
);

export const createAppLayer = (
  uiEventLayer?: Layer.Layer<UiEventService>,
): Layer.Layer<AppServiceTags> =>
  uiEventLayer ? Layer.mergeAll(baseLayer, uiEventLayer) : defaultLayer;

export const runAppEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<R>,
): Promise<A> => {
  const resolvedLayer = (layer ?? defaultLayer) as Layer.Layer<R>;
  return Effect.runPromise(Effect.provide(effect, resolvedLayer));
};

export const runAppEffectEither = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<R>,
): Promise<Either.Either<A, E>> => runAppEffect(Effect.either(effect), layer);

export const runAppEffectSync = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<R>,
): A => {
  const resolvedLayer = (layer ?? defaultLayer) as Layer.Layer<R>;
  return Effect.runSync(Effect.provide(effect, resolvedLayer));
};

export const runAppEffectSyncEither = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<R>,
): Either.Either<A, E> => runAppEffectSync(Effect.either(effect), layer);
