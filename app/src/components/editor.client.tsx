import {
	type ContextMenuItem,
	type ContextMenuState,
	type EditorApp,
	initCanvas,
	portTypeColors,
	portTypeLabels,
	portTypeOrder,
	type ShaderCompileResult,
} from "@shadr/lib-editor";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";

type PreviewStatusTone = "info" | "warning" | "error" | "ready";

type PreviewStatus = {
	tone: PreviewStatusTone;
	message: string;
	details?: string[];
};

type PreviewHandle = {
	updateShader: (result: ShaderCompileResult) => void;
	updateTexture: (file: File | null) => void;
	destroy: () => void;
};

const formatPortColor = (color: number) =>
	`#${color.toString(16).padStart(6, "0")}`;

const createShaderPreview = (
	canvas: HTMLCanvasElement,
	setStatus: (status: PreviewStatus) => void,
): PreviewHandle => {
	const gl = canvas.getContext("webgl");
	if (!gl) {
		setStatus({
			tone: "error",
			message: "WebGL is unavailable for shader preview.",
		});
		return {
			updateShader: () => {},
			updateTexture: () => {},
			destroy: () => {},
		};
	}

	const quadPositions = new Float32Array([
		-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
	]);
	const quadUvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

	const positionBuffer = gl.createBuffer();
	const uvBuffer = gl.createBuffer();
	const previewTexture = gl.createTexture();

	if (!positionBuffer || !uvBuffer || !previewTexture) {
		setStatus({
			tone: "error",
			message: "Failed to initialize preview buffers.",
		});
		return {
			updateShader: () => {},
			updateTexture: () => {},
			destroy: () => {},
		};
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadUvs, gl.STATIC_DRAW);

	const applyTextureParameters = () => {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	};

	const uploadFallbackTexture = () => {
		gl.bindTexture(gl.TEXTURE_2D, previewTexture);
		applyTextureParameters();
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([255, 255, 255, 255]),
		);
	};

	const uploadImageTexture = (image: HTMLImageElement) => {
		gl.bindTexture(gl.TEXTURE_2D, previewTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		applyTextureParameters();
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	};

	uploadFallbackTexture();

	let program: WebGLProgram | null = null;
	let positionLocation = -1;
	let uvLocation = -1;
	let timeLocation: WebGLUniformLocation | null = null;
	let textureLocation: WebGLUniformLocation | null = null;
	let animationId = 0;
	let textureLoadId = 0;

	const resizeCanvas = () => {
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
		const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}
	};

	const resizeObserver = new ResizeObserver(resizeCanvas);
	resizeObserver.observe(canvas);

	const compileShader = (type: number, source: string) => {
		const shader = gl.createShader(type);
		if (!shader) {
			return { shader: null, error: "Unable to allocate shader." };
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const error = gl.getShaderInfoLog(shader) ?? "Shader compile failed.";
			gl.deleteShader(shader);
			return { shader: null, error };
		}
		return { shader, error: "" };
	};

	const linkProgram = (vertexSource: string, fragmentSource: string) => {
		const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
		if (!vertex.shader) {
			return { program: null, error: vertex.error };
		}

		const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
		if (!fragment.shader) {
			gl.deleteShader(vertex.shader);
			return { program: null, error: fragment.error };
		}

		const nextProgram = gl.createProgram();
		if (!nextProgram) {
			gl.deleteShader(vertex.shader);
			gl.deleteShader(fragment.shader);
			return { program: null, error: "Unable to allocate shader program." };
		}

		gl.attachShader(nextProgram, vertex.shader);
		gl.attachShader(nextProgram, fragment.shader);
		gl.linkProgram(nextProgram);
		gl.deleteShader(vertex.shader);
		gl.deleteShader(fragment.shader);

		if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
			const error = gl.getProgramInfoLog(nextProgram) ?? "Link failed.";
			gl.deleteProgram(nextProgram);
			return { program: null, error };
		}

		return { program: nextProgram, error: "" };
	};

	const updateProgram = (vertexSource: string, fragmentSource: string) => {
		const next = linkProgram(vertexSource, fragmentSource);
		if (!next.program) {
			return next.error;
		}

		if (program) {
			gl.deleteProgram(program);
		}
		program = next.program;
		positionLocation = gl.getAttribLocation(program, "a_position");
		uvLocation = gl.getAttribLocation(program, "a_uv");
		timeLocation = gl.getUniformLocation(program, "u_time");
		textureLocation = gl.getUniformLocation(program, "u_texture");
		return "";
	};

	const startTime = performance.now();
	const renderFrame = () => {
		resizeCanvas();
		gl.clearColor(0.05, 0.06, 0.08, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		if (program) {
			gl.useProgram(program);

			if (positionLocation >= 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.enableVertexAttribArray(positionLocation);
				gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
			}

			if (uvLocation >= 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
				gl.enableVertexAttribArray(uvLocation);
				gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
			}

			if (timeLocation) {
				gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000);
			}

			if (textureLocation) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, previewTexture);
				gl.uniform1i(textureLocation, 0);
			}

			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}

		animationId = window.requestAnimationFrame(renderFrame);
	};

	animationId = window.requestAnimationFrame(renderFrame);

	return {
		updateShader: (result) => {
			if (!result.hasFragmentOutput) {
				if (program) {
					gl.deleteProgram(program);
					program = null;
				}
				setStatus({
					tone: "info",
					message: "Add a Fragment Output node to preview shaders.",
				});
				return;
			}

			const error = updateProgram(result.vertexSource, result.fragmentSource);
			if (error) {
				setStatus({
					tone: "error",
					message: `Preview compile failed: ${error}`,
				});
				return;
			}

			const compileErrors = result.messages
				.filter((message) => message.kind === "error")
				.map((message) => message.message);
			const compileWarnings = result.messages
				.filter((message) => message.kind === "warning")
				.map((message) => message.message);

			if (compileErrors.length > 0) {
				setStatus({
					tone: "error",
					message: "Preview errors:",
					details: compileErrors,
				});
				return;
			}

			if (compileWarnings.length > 0) {
				setStatus({
					tone: "warning",
					message: "Preview warnings:",
					details: compileWarnings,
				});
				return;
			}

			setStatus({
				tone: "ready",
				message: "Preview up to date.",
			});
		},
		updateTexture: (file) => {
			textureLoadId += 1;
			const currentLoad = textureLoadId;
			if (!file) {
				uploadFallbackTexture();
				return;
			}

			const url = URL.createObjectURL(file);
			const image = new Image();
			image.onload = () => {
				if (currentLoad !== textureLoadId) {
					URL.revokeObjectURL(url);
					return;
				}
				uploadImageTexture(image);
				URL.revokeObjectURL(url);
			};
			image.onerror = () => {
				if (currentLoad !== textureLoadId) {
					URL.revokeObjectURL(url);
					return;
				}
				setStatus({
					tone: "error",
					message: "Failed to load the texture image.",
				});
				URL.revokeObjectURL(url);
			};
			image.src = url;
		},
		destroy: () => {
			window.cancelAnimationFrame(animationId);
			resizeObserver.disconnect();
			if (program) {
				gl.deleteProgram(program);
			}
			gl.deleteBuffer(positionBuffer);
			gl.deleteBuffer(uvBuffer);
			gl.deleteTexture(previewTexture);
		},
	};
};

export default function Editor() {
	let canvasRef: HTMLCanvasElement | undefined;
	let previewRef: HTMLCanvasElement | undefined;
	let stageRef: HTMLDivElement | undefined;
	let menuRef: HTMLDivElement | undefined;
	let textureInputRef: HTMLInputElement | undefined;
	let editorHandle: EditorApp | null = null;
	let previewHandle: PreviewHandle | null = null;
	const [previewStatus, setPreviewStatus] = createSignal<PreviewStatus>({
		tone: "info",
		message: "Add a Fragment Output node to preview shaders.",
	});
	const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(
		null,
	);
	const [menuPosition, setMenuPosition] = createSignal({ x: 0, y: 0 });
	const [textureName, setTextureName] = createSignal("No texture selected");

	const handleContextMenuChange = (state: ContextMenuState) => {
		if (!state.isOpen) {
			setContextMenu(null);
			return;
		}
		setContextMenu(state);
		setMenuPosition({ x: state.screenX, y: state.screenY });
	};

	const closeContextMenu = () => {
		if (editorHandle) {
			editorHandle.closeContextMenu();
		} else {
			setContextMenu(null);
		}
	};

	const handleContextMenuItem = (item: ContextMenuItem) => {
		if (!item.enabled) {
			return;
		}
		item.action();
		closeContextMenu();
	};

	const handleTextureChange = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		setTextureName(file ? file.name : "No texture selected");
		previewHandle?.updateTexture(file);
	};

	const clearTexture = () => {
		if (textureInputRef) {
			textureInputRef.value = "";
		}
		setTextureName("No texture selected");
		previewHandle?.updateTexture(null);
	};

	const exportGlsl = () => {
		editorHandle?.exportGlsl();
	};

	createEffect(() => {
		const state = contextMenu();
		if (!state || !stageRef || !menuRef) {
			return;
		}

		const stageRect = stageRef.getBoundingClientRect();
		const menuRect = menuRef.getBoundingClientRect();
		const nextX = Math.min(
			Math.max(0, menuPosition().x),
			Math.max(0, stageRect.width - menuRect.width),
		);
		const nextY = Math.min(
			Math.max(0, menuPosition().y),
			Math.max(0, stageRect.height - menuRect.height),
		);

		if (nextX !== menuPosition().x || nextY !== menuPosition().y) {
			setMenuPosition({ x: nextX, y: nextY });
		}
	});

	onMount(async () => {
		if (!canvasRef || !previewRef) {
			return;
		}

		const preview = createShaderPreview(previewRef, setPreviewStatus);
		previewHandle = preview;
		const app = await initCanvas(canvasRef, {
			onShaderChange: (result) => {
				preview.updateShader(result);
			},
			onContextMenuChange: handleContextMenuChange,
		});
		editorHandle = app;

		onCleanup(() => {
			preview.destroy();
			app.destroy();
			editorHandle = null;
			previewHandle = null;
		});
	});

	const status = previewStatus();

	return (
		<div class="editor-shell">
			<div class="editor-stage" ref={stageRef}>
				<canvas ref={canvasRef} id="editor-canvas" />
				<Show when={contextMenu()}>
					{(state) => (
						<div
							class="context-menu-overlay"
							onPointerDown={(event) => {
								if (event.target === event.currentTarget) {
									closeContextMenu();
								}
							}}
						>
							<div
								class="context-menu"
								ref={menuRef}
								style={{
									left: `${menuPosition().x}px`,
									top: `${menuPosition().y}px`,
								}}
								onPointerDown={(event) => event.stopPropagation()}
							>
								<For each={state().items}>
									{(item) => (
										<button
											type="button"
											class="context-menu__item"
											classList={{
												"context-menu__item--disabled": !item.enabled,
											}}
											disabled={!item.enabled}
											onClick={() => handleContextMenuItem(item)}
										>
											{item.label}
										</button>
									)}
								</For>
							</div>
						</div>
					)}
				</Show>
			</div>
			<aside class="preview-panel">
				<div class="preview-header">Shader Preview</div>
				<div class="preview-controls">
					<label class="preview-control">
						<span>Texture</span>
						<input
							ref={textureInputRef}
							type="file"
							accept="image/*"
							onChange={handleTextureChange}
						/>
					</label>
					<div class="preview-control__meta">
						<span>{textureName()}</span>
						<button type="button" onClick={clearTexture}>
							Clear
						</button>
					</div>
					<button
						type="button"
						class="preview-control__action"
						onClick={exportGlsl}
					>
						Export GLSL
					</button>
				</div>
				<div class="preview-legend">
					<div class="preview-legend__title">Port Types</div>
					<div class="preview-legend__list">
						<For each={portTypeOrder}>
							{(type) => (
								<div class="preview-legend__item">
									<span
										class="preview-legend__swatch"
										style={{
											"background-color": formatPortColor(portTypeColors[type]),
										}}
									/>
									<span>{portTypeLabels[type]}</span>
								</div>
							)}
						</For>
					</div>
				</div>
				<div class="preview-frame">
					<canvas ref={previewRef} id="preview-canvas" />
				</div>
				<div class={`preview-status preview-status--${status.tone}`}>
					<span>{status.message}</span>
					<Show when={status.details && status.details.length > 0}>
						<ul class="preview-status__list">
							<For each={status.details}>{(detail) => <li>{detail}</li>}</For>
						</ul>
					</Show>
				</div>
			</aside>
		</div>
	);
}
