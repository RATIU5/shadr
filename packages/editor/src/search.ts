export type SearchEntry = {
	id: string;
	label: string;
	keywords: string;
	category: string;
	action: () => void;
};

type SearchPaletteOptions = {
	container: HTMLElement;
	entries: SearchEntry[];
	categoryOrder?: string[];
};

export type SearchPaletteController = {
	isOpen: () => boolean;
	open: () => void;
	close: () => void;
	dispose: () => void;
};

export const createSearchPalette = (
	options: SearchPaletteOptions,
): SearchPaletteController => {
	const { container, entries, categoryOrder } = options;
	const searchState = {
		isOpen: false,
		query: "",
		selectedIndex: 0,
		results: [] as SearchEntry[],
		groupedResults: [] as { category: string; entries: SearchEntry[] }[],
	};

	const searchOverlay = document.createElement("div");
	searchOverlay.className =
		"absolute inset-0 hidden items-start justify-center pt-24 bg-[rgba(8,10,14,0.72)] pointer-events-none";
	const searchPanel = document.createElement("div");
	searchPanel.className =
		"w-[min(360px,80%)] bg-[#0f131c] border border-[#1f2430] rounded-2xl p-3 shadow-[0_20px_44px_rgba(0,0,0,0.5)] flex flex-col gap-2.5 pointer-events-auto";
	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.className =
		"w-full px-2.5 py-2 rounded-lg border border-[#1f2430] bg-[#0b0f16] text-[#f4f5f7] text-[13px] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";
	searchInput.placeholder = "Search nodes...";
	const searchList = document.createElement("div");
	searchList.className = "flex flex-col gap-1.5 max-h-[360px] overflow-y-auto";
	searchPanel.append(searchInput, searchList);
	searchOverlay.append(searchPanel);
	container.appendChild(searchOverlay);

	const normalizeSearchText = (value: string) => value.toLowerCase().trim();

	const scoreSearchMatch = (query: string, target: string) => {
		if (!query) {
			return 0;
		}

		let score = 0;
		let lastIndex = -1;
		for (const char of query) {
			const index = target.indexOf(char, lastIndex + 1);
			if (index === -1) {
				return null;
			}
			if (index === lastIndex + 1) {
				score += 2;
			} else {
				score += 1;
			}
			if (index === 0 || target[index - 1] === " ") {
				score += 1;
			}
			lastIndex = index;
		}

		return score;
	};

	const getCategoryRank = (category: string) => {
		if (!categoryOrder) {
			return Number.POSITIVE_INFINITY;
		}
		const index = categoryOrder.indexOf(category);
		return index === -1 ? Number.POSITIVE_INFINITY : index;
	};

	const buildGroupedResults = (query: string) => {
		const normalizedQuery = normalizeSearchText(query);
		const scoredEntries = entries
			.map((entry) => {
				if (!normalizedQuery) {
					return { entry, score: 0 };
				}
				const target = normalizeSearchText(entry.keywords);
				const score = scoreSearchMatch(normalizedQuery, target);
				if (score === null) {
					return null;
				}
				return { entry, score };
			})
			.filter(
				(entry): entry is { entry: SearchEntry; score: number } =>
					entry !== null,
			);

		const groups = new Map<string, { entry: SearchEntry; score: number }[]>();
		scoredEntries.forEach(({ entry, score }) => {
			const group = entry.category;
			const items = groups.get(group);
			if (items) {
				items.push({ entry, score });
			} else {
				groups.set(group, [{ entry, score }]);
			}
		});

		const categories = Array.from(groups.keys()).sort((a, b) => {
			const rankA = getCategoryRank(a);
			const rankB = getCategoryRank(b);
			if (rankA !== rankB) {
				return rankA - rankB;
			}
			return a.localeCompare(b);
		});

		const groupedResults = categories.map((category) => {
			const items = groups.get(category) ?? [];
			items.sort((a, b) => {
				if (normalizedQuery && b.score !== a.score) {
					return b.score - a.score;
				}
				return a.entry.label.localeCompare(b.entry.label);
			});
			return {
				category,
				entries: items.map((item) => item.entry),
			};
		});

		const flatEntries = groupedResults.flatMap((group) => group.entries);
		return { groupedResults, flatEntries };
	};

	const renderSearchResults = () => {
		searchList.textContent = "";

		if (searchState.results.length === 0) {
			const empty = document.createElement("div");
			empty.className = "py-2 px-2.5 text-[12px] text-[#8c96a3]";
			empty.textContent = "No matches.";
			searchList.appendChild(empty);
			return;
		}

		let flatIndex = 0;
		searchState.groupedResults.forEach((group) => {
			const header = document.createElement("div");
			header.className =
				"px-2.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c96a3]";
			header.textContent = group.category;
			searchList.appendChild(header);

			group.entries.forEach((entry) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className =
					"text-left py-[7px] px-2.5 rounded-lg border border-transparent bg-transparent text-[#d7dde7] text-[13px] hover:bg-[#1f2736]";
				if (flatIndex === searchState.selectedIndex) {
					button.classList.add(
						"bg-[#1f2736]",
						"border-[#4f8dd9]",
						"text-white",
					);
				}
				button.textContent = entry.label;
				button.addEventListener("click", () => {
					entry.action();
					close();
				});
				searchList.appendChild(button);
				flatIndex += 1;
			});
		});
	};

	const updateSearchResults = () => {
		const query = normalizeSearchText(searchInput.value);
		searchState.query = query;

		const { groupedResults, flatEntries } = buildGroupedResults(query);
		searchState.groupedResults = groupedResults;
		searchState.results = flatEntries;
		if (searchState.selectedIndex >= searchState.results.length) {
			searchState.selectedIndex = 0;
		}

		renderSearchResults();
	};

	const moveSearchSelection = (delta: number) => {
		if (searchState.results.length === 0) {
			return;
		}

		const nextIndex =
			(searchState.selectedIndex + delta + searchState.results.length) %
			searchState.results.length;
		searchState.selectedIndex = nextIndex;
		renderSearchResults();
	};

	const runSelectedSearchEntry = () => {
		const entry = searchState.results[searchState.selectedIndex];
		if (!entry) {
			return;
		}
		entry.action();
		close();
	};

	const open = () => {
		if (searchState.isOpen) {
			return;
		}
		searchState.isOpen = true;
		searchState.selectedIndex = 0;
		searchInput.value = "";
		searchOverlay.classList.remove("hidden", "pointer-events-none");
		searchOverlay.classList.add("flex", "pointer-events-auto");
		updateSearchResults();
		searchInput.focus();
		searchInput.select();
	};

	const close = () => {
		if (!searchState.isOpen) {
			return;
		}
		searchState.isOpen = false;
		searchOverlay.classList.add("hidden", "pointer-events-none");
		searchOverlay.classList.remove("flex", "pointer-events-auto");
	};

	const handleSearchInput = () => {
		searchState.selectedIndex = 0;
		updateSearchResults();
	};

	const handleSearchKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			close();
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveSearchSelection(1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveSearchSelection(-1);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			runSelectedSearchEntry();
		}
	};

	const handleSearchOverlayPointerDown = (event: PointerEvent) => {
		if (event.target === searchOverlay) {
			close();
		}
	};

	searchInput.addEventListener("input", handleSearchInput);
	searchInput.addEventListener("keydown", handleSearchKeyDown);
	searchOverlay.addEventListener("pointerdown", handleSearchOverlayPointerDown);

	const dispose = () => {
		searchInput.removeEventListener("input", handleSearchInput);
		searchInput.removeEventListener("keydown", handleSearchKeyDown);
		searchOverlay.removeEventListener(
			"pointerdown",
			handleSearchOverlayPointerDown,
		);
		searchOverlay.remove();
	};

	return {
		isOpen: () => searchState.isOpen,
		open,
		close,
		dispose,
	};
};
