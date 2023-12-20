type EvntHandler = (e: Event) => void;
type Condition = (e: Event) => boolean;

type EvntKey = {
  node: Node;
  nativeEvent: string;
};

type EvntInfo = {
  name: string;
  handler: EvntHandler;
  condition?: Condition;
};

export type EvntRegistry = Map<EvntKey, EvntInfo[]>;

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Evnt {
  private static eventsRegistry: EvntRegistry = new Map();

  public static create(eventName: string, targetNode: Node, eventType: string, condition?: Condition): void {
    Evnt.registerEvent(eventName, targetNode, eventType, condition);
  }

  private static registerEvent(eventName: string, targetNode: Node, eventType: string, condition?: Condition) {
    if (Evnt.doesEventExist(eventName, targetNode, eventType)) {
    } else {
      const evntInfo: EvntInfo = { name: eventName, handler: () => {}, condition };
      const evntKey: EvntKey = { node: targetNode, nativeEvent: eventType };
      targetNode.addEventListener(eventType, Evnt._handleEvent.bind(Evnt));
      Evnt.eventsRegistry.set(evntKey, [evntInfo]);
    }
  }

  private static doesEventExist(eventName: string, targetNode: Node, eventType: string): boolean {
    for (const [key] of Evnt.eventsRegistry) {
      if (key.node === targetNode && key.nativeEvent === eventType) {
        return true;
      }
    }
    return false;
  }

  private static _handleEvent(event: Event) {
    console.log("Event");
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

// // Variant 1
// const middleDrag = Event.group("middle-mouse-down", "mouse-move");
// const spaceLeftMouse = Event.group("space-down", "left-mouse-down", "mouse-move");
// const onDrag = Event.or(middleDrag, spaceLeftMouse);
// onDrag.subscribe((e) => {
//   console.log("drag");
// });

// // Variant 2
// Event.on("middle-mouse-down")
//   .and("mouse-move")
//   .or()
//   .on("space-down")
//   .and("left-mouse-down")
//   .and("mouse-move")
//   .subscribe((e) => {
//     console.log("drag");
//   });

// // Variant 3
// Event.on("middle-mouse-down", "mouse-move")
//   .or("space-down", "left-mouse-down", "mouse-move")
//   .subscribe((e) => {
//     console.log("drag");
//   });

// // Variant 4
// Event.on("(middle-mouse-down&mouse-move)|(space-down&left-mouse-down&mouse-move)").subscribe((e) => {
//   console.log("drag");
// });
