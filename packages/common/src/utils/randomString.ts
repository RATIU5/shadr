/**
 * Create a random string; used for naming things uniquely
 *
 * Given a length, this function will generate a random string of that length
 * using the characters `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.`
 * @param length the length of the string to generate
 */
export const randomString = (length: number = 10) => {
  const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
};
