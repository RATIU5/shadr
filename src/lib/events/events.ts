export type Interaction = {
	mouse: { x: number; y: number };
};

export type ElementType = Window | Document | HTMLElement | null;
export type CallbackType<T = Event> = (e: T, i: Interaction) => void;

const interaction: Interaction = {
	mouse: {
		x: 0,
		y: 0
	}
};

export class MouseMoveEvent {
	static #callbacks: Array<CallbackType<MouseEvent>> = [];
	static #element: ElementType = null;
	static #boundCallback = MouseMoveEvent.#callback.bind(MouseMoveEvent);
	static #callback(e: Event) {
		interaction.mouse.x = (e as MouseEvent).clientX;
		interaction.mouse.y = (e as MouseEvent).clientY;
		for (let i = 0; i < MouseMoveEvent.#callbacks.length; i++) {
			MouseMoveEvent.#callbacks[i](e as MouseEvent, interaction);
		}
	}
	public static attachElement(element: ElementType) {
		MouseMoveEvent.#element = element;
		if (MouseMoveEvent.#element) {
			MouseMoveEvent.#element.addEventListener('mousemove', MouseMoveEvent.#boundCallback);
		} else {
			console.error('attempt to attach null element');
		}
	}
	public static detachElement(element: ElementType) {
		if (element && element === MouseMoveEvent.#element) {
			MouseMoveEvent.#element.removeEventListener('mousemove', MouseMoveEvent.#boundCallback);
			MouseMoveEvent.#element = null;
		} else {
			console.error('attempt to detach mismatched element');
		}
	}
	public static addCallback(callback: CallbackType) {
		MouseMoveEvent.#callbacks.push(callback);
	}
	public static removeCallback(callback: CallbackType) {
		MouseMoveEvent.#callbacks = MouseMoveEvent.#callbacks.filter((cb) => cb !== callback);
	}
}
