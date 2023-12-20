export type Callback<T = unknown> = (data?: T) => void;
export type EvntListeners<T> = {
  [Evnt in keyof T]?: Array<Callback<T[Evnt]>>;
};
type Condition = (e: Event) => boolean;

type EvntKey = string;

export type EvntInfo = Map<string, { condition?: Condition }>;
export type EvntRegistry = Map<EvntKey, EvntInfo>;

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Evnt {
  static #eventsRegistry: EvntRegistry = new Map();
  static #eventListeners: EvntListeners<Event> = {};

  public static create(eventName: string, targetNode: Node, eventType: string, condition?: Condition): void {
    Evnt.registerEvent(eventName, targetNode, eventType, condition);
  }

  private static registerEvent(eventName: string, targetNode: Node, eventType: string, condition?: Condition) {
    if (Evnt.doesEventExistInRegistry(targetNode, eventType)) {
    } else {
      const evntKey: EvntKey = targetNode.toString() + eventType;
      const evntInfo: EvntInfo = { [eventName]: { condition } };
      Evnt.#eventsRegistry.set(evntKey, evntInfo);
      targetNode.addEventListener(eventType, Evnt.#handleEvent.bind(Evnt));
    }
  }

  private static doesEventExistInRegistry(targetNode: Node, eventType: string): boolean {
    for (const [key] of Evnt.eventsRegistry) {
      // If the event name or the node and native event type match, the event already exists.
      // This prevents duplicate event names and duplicate event handlers from being registered.
      if (key === targetNode.toString() + eventType) {
        return true;
      }
    }
    return false;
  }

  static #handleEvent(event: Event) {
    // Run the correct event handler for the event type.
    const eventKey: EvntKey = (event.currentTarget as Node).toString() + event.type;
    const eventInfo: EvntInfo = Evnt.#eventsRegistry.get(eventKey) ?? {};
    for (const [eventName, { condition }] of Object.entries(eventInfo)) {
      if (condition) {
        if (condition(event)) {
          Evnt.#emit(eventName, event);
        }
      } else {
        Evnt.#emit(eventName, event);
      }
    }
  }

  static #emit(eventName: string, event: Event) {
    if (!Evnt.#eventListeners[event]) {
      return;
    }
    for (const listener of Evnt.#eventListeners[event] ?? []) {
      listener(data);
    }
  }
}

// Evnt.create("middle-mouse-down", document, "mousedown", (e) => e.button === 1);
// Evnt.create("left-mouse-down", document, "mousedown", (e) => e.button === 0);
// Evnt.create("space-down", document, "keydown", (e) => e.code === "Space");
// Evnt.create("mouse-move", document, "mousemove");

// Event.on("middle-mouse-down", "mouse-move")
//   .or()
//   .on("space-down", "left-mouse-down")
//   .subscribe((e) => {
//     console.log("drag");
//   });
