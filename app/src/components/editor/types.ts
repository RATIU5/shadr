import type { UiMessage } from "@shadr/lib-editor";

type PreviewStatusTone = "info" | "warning" | "error" | "ready";

type PreviewStatus = {
	tone: PreviewStatusTone;
	message: string;
	details?: string[];
	compileMs?: number;
};

type UiMessageItem = UiMessage & { id: number };

type ShortcutEntry = {
	id: string;
	keys: string[];
	description: string;
	detail?: string;
};

type ShortcutGroup = {
	id: string;
	label: string;
	hint: string;
	entries: ShortcutEntry[];
};

type ActionMenuId = "edit" | "view" | "file";

type ActionMenuItem = {
	id: string;
	label: string;
	action: () => void;
	disabled?: boolean;
};

type ActionMenuDefinition = {
	id: ActionMenuId;
	label: string;
	items: ActionMenuItem[];
};

export type {
	ActionMenuDefinition,
	ActionMenuId,
	PreviewStatus,
	PreviewStatusTone,
	ShortcutEntry,
	ShortcutGroup,
	UiMessageItem,
};
