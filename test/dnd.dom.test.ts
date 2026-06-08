import { afterEach, describe, expect, it, vi } from "vitest";

import type { LayoutConfig } from "../src/core/config";
import { createLayout, type LayoutEngine } from "../src/core/engine";
import type { GroupNode, LayoutNode, SplitNode } from "../src/core/types";

// jsdom doesn't implement elementFromPoint; capture whatever is there to restore.
const realElementFromPoint = document.elementFromPoint;

let host: HTMLElement;
let engine: LayoutEngine;

function mount(layout: LayoutConfig) {
  host = document.createElement("div");
  document.body.appendChild(host);
  engine = createLayout({ layout });
  engine.mount(host);
}

function stubRect(
  el: HTMLElement,
  r: { left: number; top: number; width: number; height: number },
) {
  el.getBoundingClientRect = () =>
    ({
      ...r,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON() {},
    }) as DOMRect;
}

function groupOf(panelId: string): GroupNode | undefined {
  const node = Object.values(engine.getSnapshot().tree.nodes).find(
    (n): n is GroupNode => n.type === "group" && n.tabs.includes(panelId),
  );
  return node;
}

function countSplits(): number {
  return Object.values(engine.getSnapshot().tree.nodes).filter(
    (n: LayoutNode) => n.type === "split",
  ).length;
}

// jsdom lacks PointerEvent; a MouseEvent of the same type reaches the listeners.
function pointer(type: string, target: EventTarget, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function key(target: EventTarget, k: string) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: k }),
  );
}

function sizeOf(id: string): number | undefined {
  const split = engine.getSnapshot().tree.nodes[
    engine.getSnapshot().tree.root
  ] as SplitNode;
  return engine.getSnapshot().tree.nodes[split.children[id === "a" ? 0 : 1]!]
    ?.size;
}

afterEach(() => {
  engine.destroy();
  host.remove();
  document.elementFromPoint = realElementFromPoint;
  vi.useRealTimers();
});

describe("drag to dock", () => {
  const twoGroups: LayoutConfig = {
    direction: "row",
    children: [
      { group: [{ id: "a" }, { id: "x" }] },
      { group: [{ id: "b" }, { id: "c" }] },
    ],
  };

  function dragTabInto(
    panelId: string,
    zoneX: number,
    zoneY: number,
  ): HTMLElement {
    const tab = host.querySelector<HTMLElement>(
      `[role="tab"][data-panel="${panelId}"]`,
    )!;
    const targetGroup = host
      .querySelector<HTMLElement>('[role="tab"][data-panel="b"]')!
      .closest<HTMLElement>(".layouts-group")!;
    stubRect(targetGroup, { left: 300, top: 0, width: 200, height: 200 });
    document.elementFromPoint = () => targetGroup;

    pointer("pointerdown", tab, 10, 10);
    pointer("pointermove", document, zoneX, zoneY);
    pointer("pointerup", document, zoneX, zoneY);
    return targetGroup;
  }

  it("drops onto the center to merge into that group", () => {
    mount(twoGroups);
    dragTabInto("a", 400, 100);
    expect(groupOf("a")?.tabs).toEqual(["b", "c", "a"]);
    expect(groupOf("x")?.tabs).toEqual(["x"]);
  });

  it("drops onto a side edge to dock beside as a separate region", () => {
    mount(twoGroups);
    const before = countSplits();
    dragTabInto("a", 320, 100); // left strip of the target rect
    // The row already lays out horizontally, so a joins as a flat sibling
    // before b — no redundant nested split.
    expect(countSplits()).toBe(before);
    expect(groupOf("a")?.tabs).toEqual(["a"]);
    expect(groupOf("b")?.tabs).toEqual(["b", "c"]);
    const root = engine.getSnapshot().tree.nodes[
      engine.getSnapshot().tree.root
    ] as SplitNode;
    const order = root.children.map(
      (id) => (engine.getSnapshot().tree.nodes[id] as GroupNode).tabs,
    );
    expect(order).toEqual([["x"], ["a"], ["b", "c"]]);
  });

  it("drops onto a perpendicular edge to create a split", () => {
    mount(twoGroups);
    const before = countSplits();
    dragTabInto("a", 400, 180); // bottom strip of the target rect
    expect(countSplits()).toBe(before + 1);
    expect(groupOf("a")?.tabs).toEqual(["a"]);
    expect(groupOf("b")?.tabs).toEqual(["b", "c"]);
  });
});

describe("hold to drag", () => {
  it("starts a drag only after the hold delay", () => {
    vi.useFakeTimers();
    mount({ group: [{ id: "b" }, { id: "c" }] });
    const groupEl = host.querySelector<HTMLElement>(".layouts-group")!;
    const body = host.querySelector<HTMLElement>(".layouts-panel-content")!;

    pointer("pointerdown", body, 10, 10);
    expect(groupEl.hasAttribute("data-dragging")).toBe(false);
    vi.advanceTimersByTime(250);
    expect(groupEl.hasAttribute("data-dragging")).toBe(true);
    pointer("pointerup", document, 10, 10);
  });

  it("treats movement before the hold as a scroll, not a drag", () => {
    vi.useFakeTimers();
    mount({ group: [{ id: "b" }, { id: "c" }] });
    const groupEl = host.querySelector<HTMLElement>(".layouts-group")!;
    const body = host.querySelector<HTMLElement>(".layouts-panel-content")!;

    pointer("pointerdown", body, 10, 10);
    pointer("pointermove", document, 200, 200);
    vi.advanceTimersByTime(250);
    expect(groupEl.hasAttribute("data-dragging")).toBe(false);
  });
});

describe("pointer interactions", () => {
  it("resizes a split by dragging the divider", () => {
    mount({
      direction: "row",
      children: [{ id: "a", size: 200 }, { id: "b" }],
    });
    const divider = host.querySelector<HTMLElement>(
      ".layouts-divider[data-active]",
    )!;
    pointer("pointerdown", divider, 100, 0);
    pointer("pointermove", document, 140, 0);
    pointer("pointerup", document, 140, 0);
    expect(sizeOf("a")).toBe(240);
  });

  it("activates a tab on a click without drag", () => {
    mount({ group: [{ id: "b" }, { id: "c" }] });
    const tabC = host.querySelector<HTMLElement>(
      '[role="tab"][data-panel="c"]',
    )!;
    pointer("pointerdown", tabC, 10, 10);
    pointer("pointerup", document, 10, 10);
    const root = engine.getSnapshot().tree.root;
    const node = engine.getSnapshot().tree.nodes[root];
    expect(node?.type === "group" && node.activeTab).toBe("c");
  });
});

describe("keyboard interactions", () => {
  it("moves between tabs with arrow keys and follows focus", () => {
    mount({ group: [{ id: "b" }, { id: "c" }] });
    const tabB = host.querySelector<HTMLElement>(
      '[role="tab"][data-panel="b"]',
    )!;
    tabB.focus();
    key(tabB, "ArrowRight");

    const root = engine.getSnapshot().tree.root;
    const node = engine.getSnapshot().tree.nodes[root];
    expect(node?.type === "group" && node.activeTab).toBe("c");
    expect((document.activeElement as HTMLElement)?.dataset.panel).toBe("c");
  });

  it("wraps from the last tab to the first", () => {
    mount({ group: [{ id: "b" }, { id: "c" }] });
    const tabC = host.querySelector<HTMLElement>(
      '[role="tab"][data-panel="c"]',
    );
    // c isn't active yet, so activate it first via End.
    const tabB = host.querySelector<HTMLElement>(
      '[role="tab"][data-panel="b"]',
    )!;
    tabB.focus();
    key(tabB, "End");
    expect((document.activeElement as HTMLElement)?.dataset.panel).toBe("c");
    void tabC;

    key(document.activeElement!, "ArrowRight");
    expect((document.activeElement as HTMLElement)?.dataset.panel).toBe("b");
  });

  it("resizes a split with arrow keys on the divider", () => {
    mount({
      direction: "row",
      children: [{ id: "a", size: 200 }, { id: "b" }],
    });
    const divider = host.querySelector<HTMLElement>(
      ".layouts-divider[data-active]",
    )!;
    divider.focus();
    key(divider, "ArrowRight");
    expect(sizeOf("a")).toBe(224);
    expect(document.activeElement?.getAttribute("role")).toBe("separator");
  });
});
