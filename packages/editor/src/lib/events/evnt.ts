type EventListenerCallback = (event: Event) => void;
type ConditionFunction = (event: Event) => boolean;

export class Evnt {
  private listeners: Map<string, EventListenerCallback[]>;
  private nodeEventMap: Map<Node, Map<string, { condition?: ConditionFunction; eventName: string }[]>>;

  constructor() {
    this.listeners = new Map();
    this.nodeEventMap = new Map();
  }

  public bind(node: Node, eventType: string, eventName: string, condition?: ConditionFunction) {
    if (!this.nodeEventMap.has(node)) {
      this.nodeEventMap.set(node, new Map());
    }

    const nodeMap = this.nodeEventMap.get(node);

    if (nodeMap && !nodeMap.has(eventType)) {
      nodeMap.set(eventType, []);
      node.addEventListener(eventType, (e) => this.callbackHandler(eventName, e));
    }

    const event = nodeMap?.get(eventType);

    if (event && !event.some((e) => e.eventName === eventName)) {
      event.push({
        condition,
        eventName,
      });
    }
  }

  private callbackHandler(eventName: string, event: Event) {
    console.log(this.nodeEventMap);
  }

  public on(eventName: string, callback: CallableFunction) {}
}
