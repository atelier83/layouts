import type {
  LayoutClassNames,
  LayoutNode,
  LayoutTree,
  PanelDef,
} from "./types";
import { cx } from "./utils";

type GetPanelElement = (panelId: string) => HTMLElement;
type GetPanelDef = (panelId: string) => PanelDef | undefined;

function applyChildFlex(el: HTMLElement, node: LayoutNode): void {
  el.style.flex = node.size != null ? `0 0 ${node.size}px` : "1 1 0";
  el.style.minWidth = "0";
  el.style.minHeight = "0";
  el.style.overflow = "hidden";
}

/**
 * Render `tree` into `root`. Structure only, no theme. Panel content nodes are
 * reused across renders so consumer DOM survives moves.
 */
export function renderTree(
  root: HTMLElement,
  tree: LayoutTree,
  getPanelElement: GetPanelElement,
  getPanelDef: GetPanelDef,
  classNames: LayoutClassNames = {},
): void {
  root.style.position = "relative";
  root.style.overflow = "hidden";

  function isResizable(node: LayoutNode): boolean {
    if (node.size == null) return false;
    if (node.type === "group" && getPanelDef(node.activeTab)?.fixed)
      return false;
    return true;
  }

  function renderNode(id: string): HTMLElement {
    const node = tree.nodes[id];
    if (!node) return document.createElement("div");
    return node.type === "split" ? renderSplit(node) : renderGroup(node);
  }

  function renderGroup(
    node: Extract<LayoutNode, { type: "group" }>,
  ): HTMLElement {
    const groupEl = document.createElement("div");
    groupEl.className = cx("layouts-group", classNames.group);
    groupEl.dataset.groupId = node.id;
    groupEl.style.display = "flex";
    groupEl.style.flexDirection = "column";
    groupEl.style.minWidth = "0";
    groupEl.style.minHeight = "0";
    groupEl.style.overflow = "hidden";
    groupEl.style.width = "100%";
    groupEl.style.height = "100%";

    const tabbed = node.tabs.length > 1;
    if (tabbed) {
      const tabbar = document.createElement("div");
      tabbar.className = cx("layouts-tabbar", classNames.tabbar);
      tabbar.setAttribute("role", "tablist");
      tabbar.setAttribute("aria-orientation", "horizontal");
      tabbar.style.display = "flex";
      tabbar.style.flex = "0 0 auto";
      for (const panelId of node.tabs) {
        const active = panelId === node.activeTab;
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = cx("layouts-tab", classNames.tab);
        tab.id = `${node.id}__tab__${panelId}`;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(active));
        tab.setAttribute("aria-controls", `${node.id}__panel`);
        tab.tabIndex = active ? 0 : -1; // roving tabindex
        tab.dataset.state = active ? "active" : "inactive";
        tab.dataset.panel = panelId;
        tab.dataset.groupId = node.id;
        tab.textContent = getPanelDef(panelId)?.title ?? panelId;
        tabbar.appendChild(tab);
      }
      groupEl.appendChild(tabbar);
    }

    const content = document.createElement("div");
    content.style.flex = "1 1 0";
    content.style.minWidth = "0";
    content.style.minHeight = "0";
    content.style.overflow = "hidden";
    if (tabbed) {
      content.id = `${node.id}__panel`;
      content.setAttribute("role", "tabpanel");
      content.setAttribute(
        "aria-labelledby",
        `${node.id}__tab__${node.activeTab}`,
      );
    }
    if (node.activeTab) content.appendChild(getPanelElement(node.activeTab));
    groupEl.appendChild(content);

    return groupEl;
  }

  function renderSplit(
    node: Extract<LayoutNode, { type: "split" }>,
  ): HTMLElement {
    const splitEl = document.createElement("div");
    splitEl.className = cx("layouts-split", classNames.split);
    splitEl.dataset.orientation = node.orientation;
    splitEl.style.display = "flex";
    splitEl.style.flexDirection = node.orientation === "row" ? "row" : "column";
    splitEl.style.minWidth = "0";
    splitEl.style.minHeight = "0";
    splitEl.style.overflow = "hidden";
    splitEl.style.width = "100%";
    splitEl.style.height = "100%";

    node.children.forEach((childId, i) => {
      const childNode = tree.nodes[childId];
      const childEl = renderNode(childId);
      if (childNode) applyChildFlex(childEl, childNode);
      splitEl.appendChild(childEl);

      if (i < node.children.length - 1) {
        const left = tree.nodes[node.children[i]!];
        const right = tree.nodes[node.children[i + 1]!];
        const active =
          !!(left && isResizable(left)) || !!(right && isResizable(right));
        // aria value reflects whichever neighbour carries the size being changed.
        const sized =
          left?.size != null ? left : right?.size != null ? right : null;
        const value =
          active && sized
            ? {
                now: Math.round(sized.size!),
                min: sized.min ?? 24,
                max: sized.max,
              }
            : undefined;
        splitEl.appendChild(
          makeDivider(
            node.id,
            i,
            node.orientation,
            active,
            classNames.divider,
            value,
          ),
        );
      }
    });

    return splitEl;
  }

  const top = renderNode(tree.root);
  top.style.width = "100%";
  top.style.height = "100%";
  root.replaceChildren(top);
}

function makeDivider(
  splitId: string,
  index: number,
  orientation: "row" | "column",
  active: boolean,
  className: string | undefined,
  value: { now: number; min: number; max?: number } | undefined,
): HTMLElement {
  const divider = document.createElement("div");
  divider.className = cx("layouts-divider", className);
  divider.dataset.orientation = orientation;
  divider.style.flex = "0 0 auto";
  divider.style.alignSelf = "stretch";
  // Inline structural thickness so the divider works before any theme loads.
  if (orientation === "row") divider.style.width = "3px";
  else divider.style.height = "3px";

  if (active) {
    divider.dataset.active = "";
    divider.dataset.splitId = splitId;
    divider.dataset.dividerIndex = String(index);
    divider.style.cursor = orientation === "row" ? "col-resize" : "row-resize";
    divider.setAttribute("role", "separator");
    divider.tabIndex = 0;
    divider.setAttribute(
      "aria-orientation",
      orientation === "row" ? "vertical" : "horizontal",
    );
    if (value) {
      divider.setAttribute("aria-valuenow", String(value.now));
      divider.setAttribute("aria-valuemin", String(value.min));
      if (value.max != null)
        divider.setAttribute("aria-valuemax", String(value.max));
    }
  } else {
    divider.style.pointerEvents = "none";
  }
  return divider;
}
