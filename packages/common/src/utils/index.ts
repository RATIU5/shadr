import { randomString } from "./randomString";
import { createSignal } from "./signal";

type Signal<T> = ReturnType<typeof createSignal<T>>;

export { randomString, createSignal, type Signal };
