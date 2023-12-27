/**
 * Represents a signal, an object managing a value with methods to get, set, and observe changes.
 * @template T The type of the value managed by the signal.
 */
export interface Signal<T> {
  /**
   * Gets the current value of the signal.
   * @returns The current value.
   */
  get: () => T;

  /**
   * Sets a new value for the signal.
   * @param newValue The new value to be set.
   */
  set: (newValue: T) => void;

  /**
   * Subscribes a new listener function to be called when the signal value changes.
   * @param func The function to be called when the signal value changes.
   */
  sub: (func: (val: T) => void) => void;

  /**
   * Unsubscribes a listener function from the signal.
   * @param func The listener function to be removed.
   */
  unsub: (func: (val: T) => void) => void;

  /**
   * Unsubscribes all listener functions from the signal.
   */
  unsubAll: () => void;
}

/**
 * Creates a signal with getter and setter functions to manage and observe state changes.
 * @template T The type of the value managed by the signal.
 * @param initialValue The initial value of the signal.
 * @returns An object containing methods to get, set, subscribe, unsubscribe, and unsubscribe all listeners.
 *
 * @example **Basic Usage**
 * ```ts
 * const signal = createSignal(0);
 *
 * signal.sub((value) => {
 *   console.log(value);
 * });
 *
 * signal.set(1);
 * signal.set(2);
 * ```
 * The above example will log the following:
 * ```
 * 1
 * 2
 * ```
 */
export function createSignal<T>(initialValue: T): Signal<T> {
  let _value = initialValue;
  let _listeners: ((value: T) => void)[] = [];

  /**
   * Gets the current value of the signal.
   * @returns The current value.
   */
  function get() {
    return _value;
  }

  /**
   * Sets a new value for the signal and notifies all listeners.
   * @param newValue The new value to be set.
   */
  function set(newValue: T) {
    _value = newValue;

    for (const listener of _listeners) {
      listener(newValue);
    }
  }

  /**
   * Subscribes a new listener function to the signal.
   * @param func The function to be called when the signal value changes.
   */
  function sub(func: (val: T) => void) {
    if (func) {
      _listeners.push(func);
    }
  }

  /**
   * Unsubscribes a listener function from the signal.
   * @param func The listener function to be removed.
   */
  function unsub(func: (val: T) => void) {
    _listeners = _listeners.filter((listener) => listener !== func);
  }

  /**
   * Unsubscribes all listener functions from the signal.
   */
  function unsubAll() {
    _listeners = [];
  }

  return { get, set, sub, unsub, unsubAll };
}
