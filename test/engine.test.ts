import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LayoutConfig } from "../src/core/config";
import { createLayout, type LayoutEngine } from "../src/core/engine";

const config: LayoutConfig = {
  group: [
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ],
};

let host: HTMLElement;
let engine: LayoutEngine;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  engine = createLayout({ layout: config });
});

afterEach(() => {
  engine.dispose();
  host.remove();
});

describe("engine", () => {
  it("returns the same panel element across calls", () => {
    const first = engine.getPanelElement("b");
    expect(engine.getPanelElement("b")).toBe(first);
  });

  it("notifies subscribers on commits and stops after unsubscribe", () => {
    engine.mount(host);
    const listener = vi.fn();
    const off = engine.subscribe(listener);

    engine.setActiveTab(engine.getSnapshot().tree.root, "c");
    expect(listener).toHaveBeenCalledTimes(1);

    off();
    engine.setActiveTab(engine.getSnapshot().tree.root, "b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("skips notifying when a commit is a no-op", () => {
    engine.mount(host);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setActiveTab(engine.getSnapshot().tree.root, "missing");
    expect(listener).not.toHaveBeenCalled();
  });

  it("swaps the tree on setLayout", () => {
    engine.mount(host);
    engine.setLayout({ id: "solo", title: "Solo" });
    const root =
      engine.getSnapshot().tree.nodes[engine.getSnapshot().tree.root];
    expect(root?.type).toBe("group");
    expect(host.querySelector('[data-panel="solo"]')).not.toBeNull();
  });

  it("keeps panel elements across a dispose/remount (StrictMode)", () => {
    engine.mount(host);
    const el = engine.getPanelElement("b");
    el.dataset.userState = "kept";

    engine.dispose();
    expect(host.querySelector(".layouts-root")).toBeNull();

    engine.mount(host);
    expect(engine.getPanelElement("b")).toBe(el);
    expect(
      host.querySelector<HTMLElement>('[data-panel="b"].layouts-panel-content')
        ?.dataset.userState,
    ).toBe("kept");
  });
});
