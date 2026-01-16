export type SearchEntry = {
	id: string;
	label: string;
	keywords: string;
	action: () => void;
};

type SearchPaletteOptions = {
	container: HTMLElement;
	entries: SearchEntry[];
};

export type SearchPaletteController = {
	isOpen: () => boolean;
	open: () => void;
	close: () => void;
	dispose: () => void;
};

export const createSearchPalette = ({
	container,
	entries,
}: SearchPaletteOptions): SearchPaletteController => {
	const searchState = {
		isOpen: false,
		query: "",
		selectedIndex: 0,
		results: [] as SearchEntry[],
	};

	const searchOverlay = document.createElement("div");
	searchOverlay.className = "node-search";
	const searchPanel = document.createElement("div");
	searchPanel.className = "node-search__panel";
	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.className = "node-search__input";
	searchInput.placeholder = "Search nodes...";
	const searchList = document.createElement("div");
	searchList.className = "node-search__list";
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

	const renderSearchResults = () => {
		searchList.textContent = "";

		if (searchState.results.length === 0) {
			const empty = document.createElement("div");
			empty.className = "node-search__empty";
			empty.textContent = "No matches.";
			searchList.appendChild(empty);
			return;
		}

		searchState.results.forEach((entry, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "node-search__item";
			if (index === searchState.selectedIndex) {
				button.classList.add("node-search__item--active");
			}
			button.textContent = entry.label;
			button.addEventListener("click", () => {
				entry.action();
				close();
			});
			searchList.appendChild(button);
		});
	};

	const updateSearchResults = () => {
		const query = normalizeSearchText(searchInput.value);
		searchState.query = query;

		const scored = entries
			.map((entry) => {
				const target = normalizeSearchText(entry.keywords);
				const score = scoreSearchMatch(query, target);
				if (score === null) {
					return null;
				}
				return { entry, score };
			})
			.filter(
				(entry): entry is { entry: SearchEntry; score: number } =>
					entry !== null,
			)
			.sort((a, b) => {
				if (b.score !== a.score) {
					return b.score - a.score;
				}
				return a.entry.label.localeCompare(b.entry.label);
			});

		searchState.results = scored.map((item) => item.entry).slice(0, 8);
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
		searchOverlay.classList.add("node-search--open");
		updateSearchResults();
		searchInput.focus();
		searchInput.select();
	};

	const close = () => {
		if (!searchState.isOpen) {
			return;
		}
		searchState.isOpen = false;
		searchOverlay.classList.remove("node-search--open");
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
