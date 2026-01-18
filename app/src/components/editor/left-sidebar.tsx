import { getNodeDefinitions } from "@shadr/lib-editor";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onMount,
	Show,
} from "solid-js";

type ShaderLibraryItem = {
	id: string;
	name: string;
	updatedAt: string;
	thumbnail?: string;
	graph?: string;
};

type ShaderLibraryFolder = {
	id: string;
	name: string;
	folders: ShaderLibraryFolder[];
	shaders: ShaderLibraryItem[];
};

type PaletteEntry = {
	id: string;
	label: string;
	category: string;
	description?: string;
	tags: string[];
};

type PresetItem = {
	id: string;
	name: string;
	description?: string;
	updatedAt?: string;
	builtIn?: boolean;
};

type LeftSidebarProps = {
	onCreateNode: (typeId: string) => void;
	onLoadShader?: (shader: ShaderLibraryItem) => void;
	onRecentNode?: (typeId: string) => void;
	presets: PresetItem[];
	onInsertPreset: (presetId: string) => void;
	onDeletePreset?: (presetId: string) => void;
};

export type { ShaderLibraryItem };

type LibraryRow = {
	id: string;
	label: string;
	kind: "folder" | "shader";
	depth: number;
	parentId?: string;
	folder?: ShaderLibraryFolder;
	shader?: ShaderLibraryItem;
};

const libraryStorageKey = "shadr-shader-library-v1";
const recentStorageKey = "shadr-node-recents-v1";

const paletteCategoryOrder = [
	"General",
	"Inputs",
	"Constants",
	"Math",
	"Vector",
	"Color",
	"Texture/UV",
	"Conversion",
	"Logic",
	"Output",
];

const baseLibrary: ShaderLibraryFolder = {
	id: "root",
	name: "Library",
	folders: [],
	shaders: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const parseLibrary = (value: unknown): ShaderLibraryFolder | null => {
	if (!isRecord(value)) {
		return null;
	}
	const id = typeof value.id === "string" ? value.id : null;
	const name = typeof value.name === "string" ? value.name : null;
	if (!id || !name) {
		return null;
	}
	const folders = Array.isArray(value.folders) ? value.folders : [];
	const shaders = Array.isArray(value.shaders) ? value.shaders : [];
	const parsedFolders = folders
		.map((folder) => parseLibrary(folder))
		.filter((folder): folder is ShaderLibraryFolder => Boolean(folder));
	const parsedShaders = shaders
		.map((shader): ShaderLibraryItem | null => {
			if (!isRecord(shader)) {
				return null;
			}
			const shaderId = typeof shader.id === "string" ? shader.id : null;
			const shaderName = typeof shader.name === "string" ? shader.name : null;
			const updatedAt =
				typeof shader.updatedAt === "string" ? shader.updatedAt : null;
			if (!shaderId || !shaderName || !updatedAt) {
				return null;
			}
			const thumbnail =
				typeof shader.thumbnail === "string" ? shader.thumbnail : undefined;
			const graph = typeof shader.graph === "string" ? shader.graph : undefined;
			return {
				id: shaderId,
				name: shaderName,
				updatedAt,
				...(thumbnail ? { thumbnail } : {}),
				...(graph ? { graph } : {}),
			};
		})
		.filter((shader): shader is ShaderLibraryItem => Boolean(shader));
	return { id, name, folders: parsedFolders, shaders: parsedShaders };
};

const formatDateLabel = (value: string) => {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}
	return parsed.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
};

const normalize = (value: string) => value.toLowerCase().trim();

const isMatch = (query: string, ...values: string[]) => {
	const needle = normalize(query);
	if (!needle) {
		return true;
	}
	return values.some((value) => normalize(value).includes(needle));
};

const flattenLibrary = (
	folder: ShaderLibraryFolder,
	expanded: Set<string>,
	expandAll: boolean,
	depth = 0,
	parentId?: string,
): LibraryRow[] => {
	const rows: LibraryRow[] = [];
	rows.push({
		id: folder.id,
		label: folder.name,
		kind: "folder",
		depth,
		parentId,
		folder,
	});
	const isExpanded = expandAll || expanded.has(folder.id);
	if (!isExpanded) {
		return rows;
	}
	folder.folders.forEach((child) => {
		rows.push(
			...flattenLibrary(child, expanded, expandAll, depth + 1, folder.id),
		);
	});
	folder.shaders.forEach((shader) => {
		rows.push({
			id: shader.id,
			label: shader.name,
			kind: "shader",
			depth: depth + 1,
			parentId: folder.id,
			shader,
		});
	});
	return rows;
};

const filterLibrary = (
	folder: ShaderLibraryFolder,
	query: string,
): ShaderLibraryFolder | null => {
	if (!query.trim()) {
		return folder;
	}
	const folders = folder.folders
		.map((child) => filterLibrary(child, query))
		.filter((child): child is ShaderLibraryFolder => Boolean(child));
	const shaders = folder.shaders.filter((shader) =>
		isMatch(query, shader.name),
	);
	if (
		folders.length === 0 &&
		shaders.length === 0 &&
		!isMatch(query, folder.name)
	) {
		return null;
	}
	return { ...folder, folders, shaders };
};

const paletteEntries: PaletteEntry[] = getNodeDefinitions().map(
	(definition) => ({
		id: definition.id,
		label: definition.label,
		category: definition.category,
		description: definition.description,
		tags: definition.tags,
	}),
);

export const LeftSidebar = (props: LeftSidebarProps) => {
	const [library, setLibrary] = createSignal<ShaderLibraryFolder>(baseLibrary);
	const [libraryQuery, setLibraryQuery] = createSignal("");
	const [libraryExpanded, setLibraryExpanded] = createSignal<Set<string>>(
		new Set(["root"]),
	);
	const [libraryActiveId, setLibraryActiveId] = createSignal<string | null>(
		null,
	);
	const [librarySelectedIds, setLibrarySelectedIds] = createSignal<Set<string>>(
		new Set(),
	);
	const [libraryAnchorId, setLibraryAnchorId] = createSignal<string | null>(
		null,
	);
	const [paletteQuery, setPaletteQuery] = createSignal("");
	const [paletteExpanded, setPaletteExpanded] = createSignal<Set<string>>(
		new Set(paletteCategoryOrder),
	);
	const [paletteActiveId, setPaletteActiveId] = createSignal<string | null>(
		null,
	);
	const [recentNodes, setRecentNodes] = createSignal<string[]>([]);
	let libraryFilterRef: HTMLInputElement | undefined;
	let paletteFilterRef: HTMLInputElement | undefined;

	const updateExpanded = (setFn: (next: Set<string>) => Set<string>) => {
		setLibraryExpanded((current) => setFn(new Set(current)));
	};

	const updatePaletteExpanded = (setFn: (next: Set<string>) => Set<string>) => {
		setPaletteExpanded((current) => setFn(new Set(current)));
	};

	const loadLibrary = () => {
		try {
			const raw = localStorage.getItem(libraryStorageKey);
			if (!raw) {
				return baseLibrary;
			}
			const parsed = parseLibrary(JSON.parse(raw));
			return parsed ?? baseLibrary;
		} catch {
			return baseLibrary;
		}
	};

	const loadRecents = () => {
		try {
			const raw = localStorage.getItem(recentStorageKey);
			if (!raw) {
				return [];
			}
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed.filter(
				(value): value is string => typeof value === "string",
			);
		} catch {
			return [];
		}
	};

	const saveRecents = (next: string[]) => {
		try {
			localStorage.setItem(recentStorageKey, JSON.stringify(next));
		} catch {
			// Ignore storage errors.
		}
	};

	const pushRecent = (typeId: string) => {
		setRecentNodes((current) => {
			const next = [typeId, ...current.filter((id) => id !== typeId)].slice(
				0,
				8,
			);
			saveRecents(next);
			props.onRecentNode?.(typeId);
			return next;
		});
	};

	onMount(() => {
		setLibrary(loadLibrary());
		setRecentNodes(loadRecents());
	});

	const filteredLibrary = createMemo(() => {
		const query = libraryQuery();
		const value = library();
		if (!query.trim()) {
			return value;
		}
		return filterLibrary(value, query) ?? baseLibrary;
	});

	const libraryRows = createMemo(() => {
		const query = libraryQuery().trim();
		const expanded = libraryExpanded();
		return flattenLibrary(filteredLibrary(), expanded, Boolean(query));
	});

	createEffect(() => {
		const rows = libraryRows();
		if (rows.length === 0) {
			setLibraryActiveId(null);
			setLibrarySelectedIds(new Set<string>());
			setLibraryAnchorId(null);
			return;
		}
		const current = libraryActiveId();
		const nextActive =
			current && rows.some((row) => row.id === current) ? current : rows[0].id;
		if (nextActive !== current) {
			setLibraryActiveId(nextActive);
		}
		setLibrarySelectedIds((currentSelection) => {
			const next = new Set(
				Array.from(currentSelection).filter((id) =>
					rows.some((row) => row.id === id),
				),
			);
			if (next.size === 0 && nextActive) {
				next.add(nextActive);
			}
			return next;
		});
		if (!libraryAnchorId() && nextActive) {
			setLibraryAnchorId(nextActive);
		}
	});

	const handleLibraryToggle = (id: string) => {
		updateExpanded((next) => {
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleLibraryRowClick = (
		event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">,
		row: LibraryRow,
	) => {
		const isMeta = event.metaKey || event.ctrlKey;
		const isShift = event.shiftKey;
		const rows = libraryRows();
		const anchorId = libraryAnchorId() ?? libraryActiveId() ?? row.id;
		if (isShift) {
			const startIndex = rows.findIndex((entry) => entry.id === anchorId);
			const endIndex = rows.findIndex((entry) => entry.id === row.id);
			if (startIndex !== -1 && endIndex !== -1) {
				const [from, to] =
					startIndex < endIndex
						? [startIndex, endIndex]
						: [endIndex, startIndex];
				const rangeIds = rows.slice(from, to + 1).map((entry) => entry.id);
				setLibrarySelectedIds(new Set(rangeIds));
			} else {
				setLibrarySelectedIds(new Set([row.id]));
			}
		} else if (isMeta) {
			setLibrarySelectedIds((currentSelection) => {
				const next = new Set(currentSelection);
				if (next.has(row.id)) {
					next.delete(row.id);
				} else {
					next.add(row.id);
				}
				if (next.size === 0) {
					next.add(row.id);
				}
				return next;
			});
			setLibraryAnchorId(row.id);
		} else {
			setLibrarySelectedIds(new Set([row.id]));
			setLibraryAnchorId(row.id);
		}

		setLibraryActiveId(row.id);

		if (row.kind === "folder" && !isShift && !isMeta) {
			handleLibraryToggle(row.id);
			return;
		}
		if (!isShift && !isMeta && row.shader && props.onLoadShader) {
			props.onLoadShader(row.shader);
		}
	};

	const handleLibraryKeyDown = (event: KeyboardEvent) => {
		if ((event.target as HTMLElement).tagName === "INPUT") {
			return;
		}
		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
			event.preventDefault();
			const next = `${libraryQuery()}${event.key}`;
			setLibraryQuery(next);
			libraryFilterRef?.focus();
			libraryFilterRef?.setSelectionRange(next.length, next.length);
			return;
		}
		const rows = libraryRows();
		if (rows.length === 0) {
			return;
		}
		const currentId = libraryActiveId() ?? rows[0].id;
		const index = rows.findIndex((row) => row.id === currentId);
		if (event.key === "ArrowDown") {
			event.preventDefault();
			const next = rows[Math.min(rows.length - 1, index + 1)];
			setLibraryActiveId(next.id);
			if (event.shiftKey) {
				const anchorId = libraryAnchorId() ?? currentId;
				const startIndex = rows.findIndex((row) => row.id === anchorId);
				const endIndex = rows.findIndex((row) => row.id === next.id);
				if (startIndex !== -1 && endIndex !== -1) {
					const [from, to] =
						startIndex < endIndex
							? [startIndex, endIndex]
							: [endIndex, startIndex];
					setLibrarySelectedIds(
						new Set(rows.slice(from, to + 1).map((row) => row.id)),
					);
				}
			} else {
				setLibrarySelectedIds(new Set([next.id]));
				setLibraryAnchorId(next.id);
			}
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			const next = rows[Math.max(0, index - 1)];
			setLibraryActiveId(next.id);
			if (event.shiftKey) {
				const anchorId = libraryAnchorId() ?? currentId;
				const startIndex = rows.findIndex((row) => row.id === anchorId);
				const endIndex = rows.findIndex((row) => row.id === next.id);
				if (startIndex !== -1 && endIndex !== -1) {
					const [from, to] =
						startIndex < endIndex
							? [startIndex, endIndex]
							: [endIndex, startIndex];
					setLibrarySelectedIds(
						new Set(rows.slice(from, to + 1).map((row) => row.id)),
					);
				}
			} else {
				setLibrarySelectedIds(new Set([next.id]));
				setLibraryAnchorId(next.id);
			}
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			const row = rows[index];
			if (row.kind === "folder") {
				updateExpanded((next) => {
					next.add(row.id);
					return next;
				});
			}
			return;
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			const row = rows[index];
			if (row.kind === "folder") {
				updateExpanded((next) => {
					next.delete(row.id);
					return next;
				});
			}
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const row = rows[index];
			handleLibraryRowClick(event, row);
		}
	};

	const filteredPalette = createMemo(() => {
		const query = paletteQuery().trim();
		if (!query) {
			return paletteEntries;
		}
		return paletteEntries.filter((entry) =>
			isMatch(
				query,
				entry.label,
				entry.id,
				entry.category,
				entry.description ?? "",
				entry.tags.join(" "),
			),
		);
	});

	const recentPaletteEntries = createMemo(() => {
		const query = paletteQuery().trim();
		const recentIds = recentNodes();
		const entries = recentIds
			.map((id) => paletteEntries.find((entry) => entry.id === id))
			.filter((entry): entry is PaletteEntry => Boolean(entry));
		if (!query) {
			return entries;
		}
		return entries.filter((entry) =>
			isMatch(
				query,
				entry.label,
				entry.id,
				entry.category,
				entry.description ?? "",
				entry.tags.join(" "),
			),
		);
	});

	const paletteGroups = createMemo(() => {
		const entries = filteredPalette();
		const recentIds = new Set(recentPaletteEntries().map((entry) => entry.id));
		const omitRecents = recentIds.size > 0;
		const map = new Map<string, PaletteEntry[]>();
		entries.forEach((entry) => {
			if (omitRecents && recentIds.has(entry.id)) {
				return;
			}
			const group = map.get(entry.category) ?? [];
			group.push(entry);
			map.set(entry.category, group);
		});
		const ordered = Array.from(map.entries()).sort((a, b) => {
			const aIndex = paletteCategoryOrder.indexOf(a[0]);
			const bIndex = paletteCategoryOrder.indexOf(b[0]);
			if (aIndex === -1 && bIndex === -1) {
				return a[0].localeCompare(b[0]);
			}
			if (aIndex === -1) {
				return 1;
			}
			if (bIndex === -1) {
				return -1;
			}
			return aIndex - bIndex;
		});
		return ordered;
	});

	const paletteRows = createMemo(() => {
		const rows: PaletteEntry[] = [];
		for (const entry of recentPaletteEntries()) {
			rows.push(entry);
		}
		paletteGroups().forEach(([category, entries]) => {
			const expanded = paletteExpanded().has(category) || paletteQuery().trim();
			if (!expanded) {
				return;
			}
			for (const entry of entries) {
				rows.push(entry);
			}
		});
		return rows;
	});

	createEffect(() => {
		const rows = paletteRows();
		if (rows.length === 0) {
			setPaletteActiveId(null);
			return;
		}
		const current = paletteActiveId();
		if (!current || !rows.some((row) => row.id === current)) {
			setPaletteActiveId(rows[0].id);
		}
	});

	const handlePaletteKeyDown = (event: KeyboardEvent) => {
		if ((event.target as HTMLElement).tagName === "INPUT") {
			return;
		}
		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
			event.preventDefault();
			const next = `${paletteQuery()}${event.key}`;
			setPaletteQuery(next);
			paletteFilterRef?.focus();
			paletteFilterRef?.setSelectionRange(next.length, next.length);
			return;
		}
		const rows = paletteRows();
		if (rows.length === 0) {
			return;
		}
		const currentId = paletteActiveId() ?? rows[0].id;
		const index = rows.findIndex((row) => row.id === currentId);
		if (event.key === "ArrowDown") {
			event.preventDefault();
			const next = rows[Math.min(rows.length - 1, index + 1)];
			setPaletteActiveId(next.id);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			const next = rows[Math.max(0, index - 1)];
			setPaletteActiveId(next.id);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const entry = rows[index];
			props.onCreateNode(entry.id);
			pushRecent(entry.id);
		}
	};

	const handlePaletteDragStart = (event: DragEvent, entry: PaletteEntry) => {
		if (!event.dataTransfer) {
			return;
		}
		event.dataTransfer.setData("application/x-shadr-node", entry.id);
		event.dataTransfer.setData("text/plain", entry.label);
		event.dataTransfer.effectAllowed = "copy";
		pushRecent(entry.id);
	};

	const handlePalettePick = (entry: PaletteEntry) => {
		props.onCreateNode(entry.id);
		pushRecent(entry.id);
	};

	const handlePaletteCategoryToggle = (category: string) => {
		updatePaletteExpanded((next) => {
			if (next.has(category)) {
				next.delete(category);
			} else {
				next.add(category);
			}
			return next;
		});
	};

	const emptyLibraryState = createMemo(() => {
		const current = filteredLibrary();
		return (
			current.folders.length === 0 &&
			current.shaders.length === 0 &&
			!libraryQuery().trim()
		);
	});
	const libraryShaderCount = createMemo(
		() => libraryRows().filter((row) => row.kind === "shader").length,
	);
	const presetGroups = createMemo(() => {
		const builtIn = props.presets.filter((preset) => preset.builtIn);
		const custom = props.presets.filter((preset) => !preset.builtIn);
		return { builtIn, custom };
	});
	const presetCount = createMemo(() => props.presets.length);

	return (
		<div class="absolute left-4 top-4 z-[6] flex h-[calc(100%-140px)] w-[min(320px,calc(100%-32px))] flex-col gap-3">
			<section class="flex max-h-[32%] flex-col overflow-hidden rounded-lg border border-[#2a3241] bg-[rgba(13,17,25,0.96)] shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
				<div class="border-b border-[#1f2430] px-3 py-3">
					<div class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#7f8796]">
						<span>Shader Library</span>
						<span class="text-[#4f5d72]">{libraryShaderCount()}</span>
					</div>
					<div class="mt-2">
						<input
							ref={(element) => {
								libraryFilterRef = element;
							}}
							type="text"
							value={libraryQuery()}
							onInput={(event) => setLibraryQuery(event.currentTarget.value)}
							placeholder="Filter shaders..."
							class="w-full rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
						/>
					</div>
				</div>
				<div
					class="flex-1 overflow-auto px-2 py-2"
					tabindex="0"
					role="tree"
					onKeyDown={handleLibraryKeyDown}
				>
					<Show when={emptyLibraryState()}>
						<div class="rounded-lg border border-dashed border-[#253247] bg-[#0b111a] p-3 text-[12px] text-[#7f8796]">
							No saved shaders yet. Export a graph and add it to your library to
							keep versions handy.
						</div>
					</Show>
					<For each={libraryRows()}>
						{(row) => (
							<button
								type="button"
								class={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
									librarySelectedIds().has(row.id)
										? "bg-[#152134] text-[#f4f5f7]"
										: "text-[#c6d0e1] hover:bg-[#111a2a]"
								}`}
								style={{ "margin-left": `${row.depth * 12}px` }}
								onClick={(event) => handleLibraryRowClick(event, row)}
							>
								{row.kind === "folder" ? (
									<span class="text-[#7f8796]">
										{libraryExpanded().has(row.id) ? "▾" : "▸"}
									</span>
								) : (
									<div
										class="h-7 w-7 flex-shrink-0 rounded border border-[#1b2332] bg-[#101826]"
										style={
											row.shader?.thumbnail
												? {
														"background-image": `url(${row.shader.thumbnail})`,
														"background-size": "cover",
														"background-position": "center",
													}
												: {}
										}
									/>
								)}
								<div class="min-w-0 flex-1">
									<div class="truncate">{row.label}</div>
									<Show when={row.shader}>
										<div class="text-[10px] text-[#6b7688]">
											{formatDateLabel(row.shader?.updatedAt ?? "")}
										</div>
									</Show>
								</div>
							</button>
						)}
					</For>
				</div>
			</section>

			<section class="flex max-h-[24%] flex-col overflow-hidden rounded-lg border border-[#2a3241] bg-[rgba(13,17,25,0.96)] shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
				<div class="border-b border-[#1f2430] px-3 py-3">
					<div class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#7f8796]">
						<span>Presets</span>
						<span class="text-[#4f5d72]">{presetCount()}</span>
					</div>
				</div>
				<div class="flex-1 overflow-auto px-2 py-2">
					<Show when={presetCount() === 0}>
						<div class="rounded-lg border border-dashed border-[#253247] bg-[#0b111a] p-3 text-[12px] text-[#7f8796]">
							Save a selection to capture a reusable node preset.
						</div>
					</Show>
					<Show when={presetGroups().builtIn.length > 0}>
						<div class="px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-[#6b7688]">
							Built-in
						</div>
						<div class="flex flex-col gap-2">
							<For each={presetGroups().builtIn}>
								{(preset) => (
									<div class="rounded-lg border border-[#1f2430] bg-[#0b0f16] px-2 py-2">
										<div class="flex items-center justify-between gap-2">
											<div class="min-w-0">
												<div class="truncate text-[12px] text-[#f4f5f7]">
													{preset.name}
												</div>
												<Show when={preset.description}>
													<div class="mt-1 text-[11px] text-[#7f8796]">
														{preset.description}
													</div>
												</Show>
											</div>
											<button
												type="button"
												class="rounded-full border border-[#2c3445] bg-[#151b28] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#e4e9f2] hover:bg-[#1f2736]"
												onClick={() => props.onInsertPreset(preset.id)}
											>
												Insert
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
					<Show when={presetGroups().custom.length > 0}>
						<div class="px-2 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-[#6b7688]">
							Saved
						</div>
						<div class="flex flex-col gap-2">
							<For each={presetGroups().custom}>
								{(preset) => (
									<div class="rounded-lg border border-[#1f2430] bg-[#0b0f16] px-2 py-2">
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0">
												<div class="truncate text-[12px] text-[#f4f5f7]">
													{preset.name}
												</div>
												<Show when={preset.description}>
													<div class="mt-1 text-[11px] text-[#7f8796]">
														{preset.description}
													</div>
												</Show>
												<Show when={preset.updatedAt}>
													<div class="mt-1 text-[10px] text-[#586275]">
														{formatDateLabel(preset.updatedAt ?? "")}
													</div>
												</Show>
											</div>
											<div class="flex items-center gap-1">
												<button
													type="button"
													class="rounded-full border border-[#2c3445] bg-[#151b28] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#e4e9f2] hover:bg-[#1f2736]"
													onClick={() => props.onInsertPreset(preset.id)}
												>
													Insert
												</button>
												<Show when={props.onDeletePreset}>
													<button
														type="button"
														class="rounded-full border border-[#3a2230] bg-[#1f1418] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#f5b3b3] hover:bg-[#2a171d]"
														onClick={() => props.onDeletePreset?.(preset.id)}
													>
														Remove
													</button>
												</Show>
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>
			</section>

			<section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#2a3241] bg-[rgba(13,17,25,0.96)] shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
				<div class="border-b border-[#1f2430] px-3 py-3">
					<div class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#7f8796]">
						<span>Node Palette</span>
						<span class="text-[#4f5d72]">{paletteEntries.length}</span>
					</div>
					<div class="mt-2">
						<input
							ref={(element) => {
								paletteFilterRef = element;
							}}
							type="text"
							value={paletteQuery()}
							onInput={(event) => setPaletteQuery(event.currentTarget.value)}
							placeholder="Filter nodes..."
							class="w-full rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
						/>
					</div>
				</div>
				<div
					class="flex-1 overflow-auto px-2 py-2"
					tabindex="0"
					role="listbox"
					onKeyDown={handlePaletteKeyDown}
				>
					<Show when={recentPaletteEntries().length > 0}>
						<div class="px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-[#6b7688]">
							Recent
						</div>
						<div class="flex flex-col gap-1">
							<For each={recentPaletteEntries()}>
								{(entry) => (
									<button
										type="button"
										class={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] ${
											paletteActiveId() === entry.id
												? "bg-[#152134] text-[#f4f5f7]"
												: "text-[#c6d0e1] hover:bg-[#111a2a]"
										}`}
										draggable
										onDragStart={(event) =>
											handlePaletteDragStart(event, entry)
										}
										onClick={() => handlePalettePick(entry)}
									>
										<span>{entry.label}</span>
										<span class="text-[10px] text-[#6b7688]">
											{entry.category}
										</span>
									</button>
								)}
							</For>
						</div>
					</Show>

					<For each={paletteGroups()}>
						{([category, entries]) => (
							<div class="mt-3">
								<button
									type="button"
									class="flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#6b7688] hover:bg-[#111a2a]"
									onClick={() => handlePaletteCategoryToggle(category)}
								>
									<span>{category}</span>
									<span class="text-[#4f5d72]">
										{paletteExpanded().has(category) || paletteQuery().trim()
											? "▾"
											: "▸"}
									</span>
								</button>
								<Show
									when={
										paletteExpanded().has(category) || paletteQuery().trim()
									}
								>
									<div class="mt-1 flex flex-col gap-1">
										<For each={entries}>
											{(entry) => (
												<button
													type="button"
													class={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] ${
														paletteActiveId() === entry.id
															? "bg-[#152134] text-[#f4f5f7]"
															: "text-[#c6d0e1] hover:bg-[#111a2a]"
													}`}
													draggable
													onDragStart={(event) =>
														handlePaletteDragStart(event, entry)
													}
													onClick={() => handlePalettePick(entry)}
												>
													<span>{entry.label}</span>
													<span class="text-[10px] text-[#6b7688]">
														{entry.category}
													</span>
												</button>
											)}
										</For>
									</div>
								</Show>
							</div>
						)}
					</For>

					<Show when={paletteRows().length === 0}>
						<div class="rounded-lg border border-dashed border-[#253247] bg-[#0b111a] p-3 text-[12px] text-[#7f8796]">
							No nodes match that filter.
						</div>
					</Show>
				</div>
			</section>
		</div>
	);
};
