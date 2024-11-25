export type EventType = { [key: string]: unknown };
export type Callback<T> = (data: T) => void;
export type EventListeners<T> = {
  [Event in keyof T]?: Array<Callback<T[Event]>>;
};

export type EventBus<T> = {
  on: <Event extends keyof T>(event: Event, listener: Callback<T[Event]>) => void;
  off: <Event extends keyof T>(
    event: Event,
    listenerToRemove: Callback<T[Event]>
  ) => void;
  emit: <Event extends keyof T>(event: Event, data: T[Event]) => void;
};
