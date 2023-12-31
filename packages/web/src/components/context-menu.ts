import { ICanvas } from "pixi.js";

export type ContextItem = {
  type: "item" | "separator";
  label?: string;
  action?: (mouse: { x: number; y: number }) => void;
  disabled?: boolean;
  items?: ContextItem[];
};

// TODO: Add keyboard navigation

export function initializeContextComponent(element: ICanvas, initialItems: ContextItem[]) {
  const contextMenuInstance = contextMenu(element, initialItems);
  return {
    updateItems: (newItems: ContextItem[]) => contextMenuInstance.update(newItems),
    destroy: () => contextMenuInstance.destroy(),
  };
}

export function contextMenu(node: ICanvas, initialItems: ContextItem[]) {
  let mouseX = 0;
  let mouseY = 0;
  let items = initialItems;

  const menu = document.createElement("ul");
  menu.id = "context-menu";
  menu.className =
    "absolute bg-neutral-800 shadow-xl rounded-md p-1 inset-border min-w-52 text-neutral-300 text-[13px] z-10";
  menu.style.display = "none";
  document.body.appendChild(menu);

  function updateMenuItems() {
    menu.innerHTML = "";
    for (const item of items) {
      const li = createItem(item, menu, menu, node);
      menu.appendChild(li);
    }
  }

  updateMenuItems();

  function handleOuterClick(event: Event) {
    if (!menu.contains(event.target as Node)) {
      menu.style.display = "none";
      document.removeEventListener("click", handleOuterClick);
    }
  }

  node.addEventListener?.("mousemove", (e) => {
    mouseX = (e as MouseEvent).clientX;
    mouseY = (e as MouseEvent).clientY;
  });

  node.addEventListener?.("contextmenu", (e) => {
    e.preventDefault();

    menu.style.display = "block";

    const menuRect = menu.getBoundingClientRect();
    const viewportRect = node.getBoundingClientRect?.();
    const viewportWidth = viewportRect?.width ?? 0;
    const viewportHeight = viewportRect?.height ?? 0;

    if ((e as MouseEvent).clientX + menuRect.width > viewportWidth) {
      mouseX = (e as MouseEvent).clientX - menuRect.width;
    } else {
      mouseX = (e as MouseEvent).clientX;
    }

    if ((e as MouseEvent).clientY + menuRect.height > viewportHeight) {
      mouseY = (e as MouseEvent).clientY - menuRect.height;
    } else {
      mouseY = (e as MouseEvent).clientY;
    }

    menu.style.top = `${mouseY}px`;
    menu.style.left = `${mouseX}px`;

    document.addEventListener("click", handleOuterClick);
  });

  return {
    destroy() {
      document.body.removeChild(menu);
      node.removeEventListener?.("contextmenu", handleOuterClick);
    },
    update(newItems: Array<ContextItem>) {
      items = newItems;
      updateMenuItems();
    },
  };
}

function createItem(item: ContextItem, _: HTMLUListElement, rootMenu: HTMLUListElement, node: ICanvas): HTMLLIElement {
  const li = document.createElement("li");
  li.className = item.disabled
    ? "text-neutral-600 rounded cursor-default py-1 px-3 flex items-center gap-2 select-none"
    : "hover:bg-neutral-700 rounded cursor-pointer py-1 px-3 flex items-center gap-2 select-none";

  if (item.type === "separator") {
    li.className = "h-px bg-neutral-700 my-2 mx-3";
    return li;
  }

  li.innerHTML = `${item.label ?? "undefined"}${item.items && item.items.length > 0 ? iconCheveronRight() : ""}`;
  if (!item.disabled) {
    if (item.action) {
      li.addEventListener("click", (e) => {
        item.action?.({ x: e.clientX, y: e.clientY });
        rootMenu.style.display = "none";
      });
    } else if (item.items && item.items.length > 0) {
      const submenu = document.createElement("ul");
      submenu.className =
        "absolute bg-neutral-800 shadow-xl rounded-md p-1 inset-border min-w-52 text-neutral-300 text-[13px] z-10 left-full top-0 -ml-1 hidden";
      submenu.id = "context-submenu";

      for (const subItem of item.items) {
        submenu.appendChild(createItem(subItem, submenu, rootMenu, node));
      }

      li.appendChild(submenu);
      li.className += " relative";

      li.addEventListener("mouseenter", () => {
        submenu.style.display = "block";
        setTimeout(() => {
          const submenuRect = submenu.getBoundingClientRect();
          const viewportRect = node.getBoundingClientRect?.();
          const viewportWidth = viewportRect?.width ?? 0;
          const viewportHeight = viewportRect?.height ?? 0;

          if (submenuRect.right > viewportWidth) {
            submenu.style.left = `-${submenuRect.width - 8}px`;
          }

          if (submenuRect.bottom > viewportHeight) {
            submenu.style.top = `-${submenuRect.height - li.offsetHeight - 3}px`;
          }
        }, 0);
      });

      li.addEventListener("mouseleave", () => {
        submenu.style.display = "none";
        submenu.style.left = "";
        submenu.style.top = "";
      });
    }
  }

  return li;
}

function iconCheveronRight() {
  return `<svg xmlns="http://www.w3.org/2000/svg"  width="18" height="18" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>`;
}
