type Subscriber = () => void;
const subscribers = new WeakMap<object, Set<Subscriber>>();

/**
 * Create a signal object. A signal object can be used to store a value and notify subscribers when the value changes.
 *
 * @example
 *
 * const signal = createSignal(0);
 *
 * signal.subscribe(() => {
 *  console.log(signal.value);
 * });
 *
 * @param value the initial value of the signal
 * @returns a signal object
 */
export function createSignal<T>(value: T) {
  const target = { value };
  let pending = false;

  return {
    /**
     * The current value of the signal
     */
    get value() {
      return target.value;
    },
    /**
     * Set a new value for the signal and notify subscribers
     * @param newValue the new value
     */
    set value(newValue: T) {
      if (Object.is(target.value, newValue)) return;
      target.value = newValue;

      if (!pending) {
        pending = true;
        queueMicrotask(() => {
          pending = false;
          subscribers.get(target)?.forEach((fn) => fn());
        });
      }
    },
    /**
     * Subscribe to changes in the value of the signal
     * @param fn a function to be called when the value of the signal changes
     * @returns a function to unsubscribe from the signal
     */
    subscribe(fn: Subscriber) {
      let subs = subscribers.get(target);
      if (!subs) {
        subs = new Set();
        subscribers.set(target, subs);
      }
      subs.add(fn);
      return () => subs?.delete(fn);
    },
  };
}
