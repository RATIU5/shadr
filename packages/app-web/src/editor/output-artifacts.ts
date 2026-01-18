import type { JsonValue } from "@shadr/shared";

export const OUTPUT_NODE_TYPES = {
  "output-text-float": "text",
  "output-text-int": "text",
  "output-text-bool": "text",
  "output-text-vec2": "text",
  "output-text-vec3": "text",
  "output-text-vec4": "text",
  "output-code-float": "code",
  "output-code-int": "code",
  "output-code-bool": "code",
  "output-code-vec2": "code",
  "output-code-vec3": "code",
  "output-code-vec4": "code",
  "output-image-float": "image",
  "output-image-vec3": "image",
  "output-image-vec4": "image",
} as const;

export type OutputNodeType = keyof typeof OUTPUT_NODE_TYPES;

export type OutputArtifact =
  | Readonly<{
      kind: "text";
      label: "Text";
      mimeType: "text/plain";
      filename: "output.txt";
      text: string;
    }>
  | Readonly<{
      kind: "code";
      label: "Code";
      mimeType: "text/plain";
      filename: "output.glsl";
      text: string;
    }>
  | Readonly<{
      kind: "image";
      label: "Image";
      mimeType: "image/png";
      filename: "output.png";
      dataUrl: string;
      blob: Blob;
      width: number;
      height: number;
    }>;

export type OutputArtifactResult = Readonly<{
  artifact: OutputArtifact | null;
  error: string | null;
}>;

export const isOutputNodeType = (value: string): value is OutputNodeType =>
  value in OUTPUT_NODE_TYPES;

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

const formatPlainText = (value: JsonValue | null): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

const formatCodeLiteral = (value: JsonValue | null): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
};

const coerceColor = (
  value: JsonValue | null,
): [number, number, number, number] | null => {
  if (typeof value === "number") {
    const v = clamp01(value);
    return [v, v, v, 1];
  }
  if (typeof value === "boolean") {
    const v = value ? 1 : 0;
    return [v, v, v, 1];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const numbers: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number") {
      return null;
    }
    numbers.push(entry);
  }
  if (numbers.length === 3) {
    return [clamp01(numbers[0]), clamp01(numbers[1]), clamp01(numbers[2]), 1];
  }
  if (numbers.length === 4) {
    return [
      clamp01(numbers[0]),
      clamp01(numbers[1]),
      clamp01(numbers[2]),
      clamp01(numbers[3]),
    ];
  }
  return null;
};

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  if (typeof atob === "undefined") {
    return null;
  }
  const [header, data] = dataUrl.split(",");
  if (!header || !data) {
    return null;
  }
  const match = /^data:([^;]+);base64$/u.exec(header);
  const mimeType = match ? match[1] : "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const compileImageArtifact = (
  value: JsonValue | null,
): OutputArtifactResult => {
  if (typeof document === "undefined") {
    return {
      artifact: null,
      error: "Image outputs require a browser context.",
    };
  }
  const color = coerceColor(value);
  if (!color) {
    return {
      artifact: null,
      error: "Image output expects a number or vec3/vec4 color.",
    };
  }
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return { artifact: null, error: "Unable to acquire canvas context." };
  }
  const [r, g, b, a] = color;
  context.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(
    g * 255,
  )}, ${Math.round(b * 255)}, ${a})`;
  context.fillRect(0, 0, size, size);
  const dataUrl = canvas.toDataURL("image/png");
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) {
    return { artifact: null, error: "Unable to create image blob." };
  }
  return {
    artifact: {
      kind: "image",
      label: "Image",
      mimeType: "image/png",
      filename: "output.png",
      dataUrl,
      blob,
      width: size,
      height: size,
    },
    error: null,
  };
};

export const compileOutputArtifact = (
  nodeType: OutputNodeType,
  value: JsonValue | null,
): OutputArtifactResult => {
  const kind = OUTPUT_NODE_TYPES[nodeType];
  if (kind === "image") {
    return compileImageArtifact(value);
  }
  if (kind === "code") {
    const literal = formatCodeLiteral(value);
    return {
      artifact: {
        kind: "code",
        label: "Code",
        mimeType: "text/plain",
        filename: "output.glsl",
        text: `const value = ${literal};\n`,
      },
      error: null,
    };
  }
  return {
    artifact: {
      kind: "text",
      label: "Text",
      mimeType: "text/plain",
      filename: "output.txt",
      text: formatPlainText(value),
    },
    error: null,
  };
};

export const downloadOutputArtifact = (
  artifact: OutputArtifact,
): string | null => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return "Downloads require a browser context.";
  }
  const blob =
    artifact.kind === "image"
      ? artifact.blob
      : new Blob([artifact.text], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return null;
};
