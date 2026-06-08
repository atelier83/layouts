import type { LayoutEngine } from "./engine";
import type { LayoutClassNames } from "./types";
import { cx } from "./utils";

const DRAG_THRESHOLD = 4;
const HOLD_MS = 220;
const STRIP = 0.28;
const KEY_RESIZE_STEP = 24;

export type Rect = { left: number; top: number; width: number; height: number };

export type DropZone = "left" | "right" | "top" | "bottom" | "middle";
type Drop = { groupId: string; zone: DropZone };

export function zoneRect(r: Rect, zone: DropZone): Rect {
  const { left, top, width: w, height: h } = r;
  switch (zone) {
    case "left":
      return { left, top, width: w * STRIP, height: h };
    case "right":
      return { left: left + w * (1 - STRIP), top, width: w * STRIP, height: h };
    case "top":
      return { left, top, width: w, height: h * STRIP };
    case "bottom":
      return { left, top: top + h * (1 - STRIP), width: w, height: h * STRIP };
    case "middle":
      return { left, top, width: w, height: h };
  }
}

/** Which of the five zones (x, y) lands in. Corners resolve to left/right. */
export function zoneAt(r: Rect, x: number, y: number): DropZone {
  const right = r.left + r.width;
  const bottom = r.top + r.height;
  const inLeft = x < r.left + r.width * STRIP;
  const inRight = x > right - r.width * STRIP;
  const inTop = !inLeft && !inRight && y < r.top + r.height * STRIP;
  const inBottom = !inLeft && !inRight && y > bottom - r.height * STRIP;
  if (inLeft) return "left";
  if (inRight) return "right";
  if (inTop) return "top";
  if (inBottom) return "bottom";
  return "middle";
}

interface ResizeGesture {
  kind: "resize";
  splitId: string;
  index: number;
  orientation: "row" | "column";
  last: number;
}

interface PanelGesture {
  kind: "panel";
  panelId: string;
  sourceGroupId: string;
  startX: number;
  startY: number;
  mode: "tab" | "hold";
  canDrag: boolean;
  dragging: boolean;
  holdTimer: number | null;
  drop: Drop | null;
}

type Gesture = ResizeGesture | PanelGesture;

export function attachInteractions(
  root: HTMLElement,
  engine: LayoutEngine,
  classNames: LayoutClassNames = {},
): () => void {
  let gesture: Gesture | null = null;
  let overlay: HTMLElement | null = null;

  const isFixed = (panelId: string) => !!engine.getPanelDef(panelId)?.fixed;

  function activePanelOf(groupId: string): string | null {
    const node = engine.getSnapshot().tree.nodes[groupId];
    return node?.type === "group" ? node.activeTab : null;
  }

  function computeDrop(
    groupEl: HTMLElement,
    x: number,
    y: number,
  ): { drop: Drop; rect: Rect } | null {
    const groupId = groupEl.dataset.groupId;
    if (!groupId) return null;
    const groupNode = engine.getSnapshot().tree.nodes[groupId];
    if (groupNode?.type !== "group") return null;
    if (groupNode.tabs.every((t) => engine.getPanelDef(t)?.fixed)) return null;

    const dom = groupEl.getBoundingClientRect();
    const r: Rect = {
      left: dom.left,
      top: dom.top,
      width: dom.width,
      height: dom.height,
    };
    const zone = zoneAt(r, x, y);
    return { drop: { groupId, zone }, rect: zoneRect(r, zone) };
  }

  function showOverlay(rect: Rect, zone: DropZone): void {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = cx("layouts-drop-overlay", classNames.dropOverlay);
      overlay.style.cssText =
        "position:absolute;pointer-events:none;z-index:1000;";
    }
    if (overlay.parentElement !== root) root.appendChild(overlay);
    overlay.dataset.zone = zone;
    const rr = root.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block",
      left: `${rect.left - rr.left}px`,
      top: `${rect.top - rr.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function hideOverlay(): void {
    if (overlay) overlay.style.display = "none";
  }

  function setDragging(groupId: string, active: boolean): void {
    const el = root.querySelector<HTMLElement>(
      `.layouts-group[data-group-id="${groupId}"]`,
    );
    el?.toggleAttribute("data-dragging", active);
  }

  function clearHold(): void {
    if (gesture?.kind === "panel" && gesture.holdTimer != null) {
      clearTimeout(gesture.holdTimer);
      gesture.holdTimer = null;
    }
  }

  function startPanelGesture(
    panelId: string,
    groupId: string,
    x: number,
    y: number,
    mode: "tab" | "hold",
  ): void {
    const canDrag = !isFixed(panelId);
    const g: PanelGesture = {
      kind: "panel",
      panelId,
      sourceGroupId: groupId,
      startX: x,
      startY: y,
      mode,
      canDrag,
      dragging: false,
      holdTimer: null,
      drop: null,
    };
    gesture = g;
    if (mode === "hold" && canDrag) {
      g.holdTimer = window.setTimeout(() => {
        g.dragging = true;
        document.body.style.userSelect = "none";
        setDragging(groupId, true);
      }, HOLD_MS);
    }
  }

  function onPointerDown(e: PointerEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el) return;

    const divider = el.closest<HTMLElement>(".layouts-divider[data-active]");
    if (divider?.dataset.splitId && divider.dataset.dividerIndex) {
      const isRow = divider.dataset.orientation === "row";
      gesture = {
        kind: "resize",
        splitId: divider.dataset.splitId,
        index: Number(divider.dataset.dividerIndex),
        orientation: isRow ? "row" : "column",
        last: isRow ? e.clientX : e.clientY,
      };
      document.body.style.userSelect = "none";
      e.preventDefault();
      return;
    }

    const tab = el.closest<HTMLElement>(".layouts-tab");
    if (tab?.dataset.panel && tab.dataset.groupId) {
      startPanelGesture(
        tab.dataset.panel,
        tab.dataset.groupId,
        e.clientX,
        e.clientY,
        "tab",
      );
      return;
    }

    const groupEl = el.closest<HTMLElement>(".layouts-group");
    if (groupEl?.dataset.groupId) {
      const active = activePanelOf(groupEl.dataset.groupId);
      if (active) {
        startPanelGesture(
          active,
          groupEl.dataset.groupId,
          e.clientX,
          e.clientY,
          "hold",
        );
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!gesture) return;

    if (gesture.kind === "resize") {
      const pos = gesture.orientation === "row" ? e.clientX : e.clientY;
      const delta = pos - gesture.last;
      if (delta !== 0) {
        engine.resize(gesture.splitId, gesture.index, delta);
        gesture.last = pos;
      }
      return;
    }

    if (!gesture.canDrag) return;

    if (!gesture.dragging) {
      const moved =
        Math.abs(e.clientX - gesture.startX) >= DRAG_THRESHOLD ||
        Math.abs(e.clientY - gesture.startY) >= DRAG_THRESHOLD;
      if (gesture.mode === "tab") {
        if (!moved) return;
        gesture.dragging = true;
        document.body.style.userSelect = "none";
        setDragging(gesture.sourceGroupId, true);
      } else {
        // Moving before the hold fires is a scroll/miss, not a drag.
        if (moved) {
          clearHold();
          gesture = null;
        }
        return;
      }
    }

    const hit = document.elementFromPoint(
      e.clientX,
      e.clientY,
    ) as HTMLElement | null;
    const groupEl = hit?.closest<HTMLElement>(".layouts-group") ?? null;
    const result = groupEl ? computeDrop(groupEl, e.clientX, e.clientY) : null;
    if (result) {
      gesture.drop = result.drop;
      showOverlay(result.rect, result.drop.zone);
    } else {
      gesture.drop = null;
      hideOverlay();
    }
  }

  function onPointerUp(): void {
    if (!gesture) return;
    clearHold();
    const g = gesture;
    gesture = null;
    document.body.style.userSelect = "";
    hideOverlay();

    if (g.kind !== "panel") return;
    if (g.dragging) setDragging(g.sourceGroupId, false);

    if (g.dragging && g.drop) {
      const { groupId, zone } = g.drop;
      if (zone === "middle") engine.moveTab(g.panelId, { groupId });
      else engine.attachPanel(g.panelId, groupId, zone);
    } else if (!g.dragging && g.mode === "tab") {
      engine.setActiveTab(g.sourceGroupId, g.panelId);
    }
  }

  function refocus(selector: string): void {
    // The op re-renders the affected subtree synchronously, so the focused
    // node is gone; move focus to its freshly rendered replacement.
    root.querySelector<HTMLElement>(selector)?.focus();
  }

  function onTabKey(tab: HTMLElement, key: string): boolean {
    const groupId = tab.dataset.groupId!;
    const node = engine.getSnapshot().tree.nodes[groupId];
    if (node?.type !== "group") return false;
    const { tabs } = node;
    const cur = tabs.indexOf(tab.dataset.panel!);
    if (cur < 0) return false;
    let next = cur;
    if (key === "ArrowLeft") next = (cur - 1 + tabs.length) % tabs.length;
    else if (key === "ArrowRight") next = (cur + 1) % tabs.length;
    else if (key === "Home") next = 0;
    else if (key === "End") next = tabs.length - 1;
    else return false;
    const nextId = tabs[next]!;
    engine.setActiveTab(groupId, nextId);
    refocus(`.layouts-tab[data-group-id="${groupId}"][data-panel="${nextId}"]`);
    return true;
  }

  function onDividerKey(divider: HTMLElement, key: string): boolean {
    const splitId = divider.dataset.splitId!;
    const index = Number(divider.dataset.dividerIndex);
    const isRow = divider.dataset.orientation === "row";
    let delta = 0;
    if (isRow && key === "ArrowRight") delta = KEY_RESIZE_STEP;
    else if (isRow && key === "ArrowLeft") delta = -KEY_RESIZE_STEP;
    else if (!isRow && key === "ArrowDown") delta = KEY_RESIZE_STEP;
    else if (!isRow && key === "ArrowUp") delta = -KEY_RESIZE_STEP;
    else return false;
    engine.resize(splitId, index, delta);
    refocus(
      `.layouts-divider[data-split-id="${splitId}"][data-divider-index="${index}"]`,
    );
    return true;
  }

  function onKeyDown(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    const tab = el.closest<HTMLElement>(".layouts-tab");
    if (tab?.dataset.panel && tab.dataset.groupId) {
      if (onTabKey(tab, e.key)) e.preventDefault();
      return;
    }
    const divider = el.closest<HTMLElement>(".layouts-divider[data-active]");
    if (divider?.dataset.splitId && divider.dataset.dividerIndex) {
      if (onDividerKey(divider, e.key)) e.preventDefault();
    }
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);

  return () => {
    clearHold();
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    overlay?.remove();
    overlay = null;
    document.body.style.userSelect = "";
  };
}
