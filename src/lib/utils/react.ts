export class React<T = any> {
	#_value: T;
	#callbacks: ((value: T) => void)[] = [];

	constructor(defaultValue: T) {
		this.#_value = defaultValue;
	}
	get value() {
		return this.#_value;
	}
	set value(val) {
		this.#_value = val;
		this.#callbacks.forEach((callback) => callback(val));
	}
	addZoomFactorCallback(callback: (value: T) => void) {
		this.#callbacks.push(callback);
	}
}
