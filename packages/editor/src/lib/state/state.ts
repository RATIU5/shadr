/**
 * A simple state class that can be used to store state in a class.
 * It is a wrapper around a plain object that allows for getting and setting values with type safety.
 * @template T The type of the state object.
 */
export class State<T extends object = object> {
  /**
   * The state object.
   */
  #state: T;

  /**
   * Initializes the state object with the initial state.
   * @param {T} initialState The initial state object.
   */
  constructor(initialState: T) {
    this.#state = initialState;
  }

  /**
   * Sets a value in the state object.
   * @param {K} key The key of the value to set.
   * @param {T[K]} value The value to set.
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.#state[key] = value;
  }

  /**
   * Gets a value from the state object.
   * @param {K} key The key of the value to get.
   * @returns {T[K]} The value from the state object.
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.#state[key];
  }
}
