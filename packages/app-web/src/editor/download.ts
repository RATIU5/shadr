export const downloadTextFile = (
  filename: string,
  text: string,
  mimeType = "application/json",
): string | null => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return "Downloads require a browser context.";
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return null;
};
