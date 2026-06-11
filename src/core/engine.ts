import type { LayoutConfig } from "./config";
import { fromConfig } from "./config";
import { attachInteractions } from "./dnd";
import { renderTree } from "./dom-host";
import * as ops from "./tree";
import type {
  LayoutClassNames,
  LayoutTree,
  MoveTarget,
  NodeId,
  PanelDef,
  Side,
} from "./types";
import { cx } from "./utils";

export interface CreateLayoutOptions {
  layout: LayoutConfig;
  /** Class names merged onto each rendered part. See {@link LayoutClassNames}. */
  classNames?: LayoutClassNames;
}

export interface LayoutSnapshot {
  tree: LayoutTree;
}

export interface LayoutEngine {
  /** The content element for a panel, created on first ask. Fill it with your own DOM. */
  getPanelElement(panelId: string): HTMLElement;
  getPanelDef(panelId: string): PanelDef | undefined;
  getSnapshot(): LayoutSnapshot;
  subscribe(listener: () => void): () => void;
  mount(root: HTMLElement): void;
  setLayout(layout: LayoutConfig): void;
  resize(splitId: NodeId, dividerIndex: number, deltaPx: number): void;
  setActiveTab(groupId: NodeId, panelId: string): void;
  moveTab(panelId: string, target: MoveTarget): void;
  attachPanel(panelId: string, targetGroupId: NodeId, side: Side): void;
  dispose(): void;
}

function expand(layout: LayoutConfig): {
  tree: LayoutTree;
  defs: Map<string, PanelDef>;
} {
  const { tree, panels } = fromConfig(layout);
  const defs = new Map<string, PanelDef>();
  for (const def of panels) defs.set(def.id, def);
  return { tree, defs };
}

export function createLayout(options: CreateLayoutOptions): LayoutEngine {
  const initial = expand(options.layout);
  let tree = initial.tree;
  let snapshot: LayoutSnapshot = { tree };
  const panelDefs = initial.defs;
  const classNames = options.classNames ?? {};
  const rootClasses = cx("layouts-root", classNames.root)
    .split(/\s+/)
    .filter(Boolean);

  // Panel elements outlive renders so consumer DOM (and its state) rides along
  // as panels move between regions.
  const panelElements = new Map<string, HTMLElement>();
  const listeners = new Set<() => void>();

  let root: HTMLElement | null = null;
  let detachInteractions: (() => void) | null = null;

  function getPanelElement(panelId: string): HTMLElement {
    let el = panelElements.get(panelId);
    if (!el) {
      el = document.createElement("div");
      el.className = cx("layouts-panel-content", classNames.panelContent);
      el.dataset.panel = panelId;
      el.style.width = "100%";
      el.style.height = "100%";
      panelElements.set(panelId, el);
    }
    return el;
  }

  function render(): void {
    if (root) {
      renderTree(
        root,
        tree,
        getPanelElement,
        (id) => panelDefs.get(id),
        classNames,
      );
    }
  }

  function commit(next: LayoutTree): void {
    if (next === tree) return;
    tree = next;
    snapshot = { tree };
    render();
    for (const listener of listeners) listener();
  }

  const engine: LayoutEngine = {
    getPanelElement,
    getPanelDef: (panelId) => panelDefs.get(panelId),
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mount(hostEl) {
      detachInteractions?.();
      detachInteractions = null;
      root = hostEl;
      root.classList.add(...rootClasses);
      render();
      detachInteractions = attachInteractions(root, engine, classNames);
    },
    setLayout(layout) {
      const { tree: newTree, defs: newDefs } = expand(layout);
      for (const [id, def] of newDefs) panelDefs.set(id, def);
      commit(newTree);
    },
    resize(splitId, dividerIndex, deltaPx) {
      commit(ops.resize(tree, splitId, dividerIndex, deltaPx));
    },
    setActiveTab(groupId, panelId) {
      commit(ops.setActiveTab(tree, groupId, panelId));
    },
    moveTab(panelId, target) {
      commit(ops.moveTab(tree, panelId, target));
    },
    attachPanel(panelId, targetGroupId, side) {
      commit(ops.attach(tree, panelId, targetGroupId, side));
    },
    dispose() {
      detachInteractions?.();
      detachInteractions = null;
      if (root) {
        root.replaceChildren();
        root.classList.remove(...rootClasses);
      }
      root = null;
      listeners.clear();
      // Keep panelElements: a remount (e.g. React StrictMode) reuses the same
      // nodes, so consumer content and portals survive the teardown/re-mount.
    },
  };

  return engine;
}
