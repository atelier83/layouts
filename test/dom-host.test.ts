import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LayoutConfig } from "../src/core/config";
import { createLayout, type LayoutEngine } from "../src/core/engine";

const config: LayoutConfig = {
  direction: "row",
  children: [
    { id: "a", title: "A", size: 200 },
    {
      group: [
        { id: "b", title: "B" },
        { id: "c", title: "C" },
      ],
    },
  ],
};

let host: HTMLElement;
let engine: LayoutEngine;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  engine = createLayout({ layout: config });
  engine.mount(host);
});

afterEach(() => {
  engine.dispose();
  host.remove();
});

describe("renderTree", () => {
  it("marks the host as the themed root", () => {
    expect(host.classList.contains("layouts-root")).toBe(true);
  });

  it("renders the split with its orientation", () => {
    const split = host.querySelector(".layouts-split");
    expect(split?.getAttribute("data-orientation")).toBe("row");
  });

  it("renders an active, focusable divider as a separator", () => {
    const divider = host.querySelector<HTMLElement>(
      ".layouts-divider[data-active]",
    );
    expect(divider).not.toBeNull();
    expect(divider!.getAttribute("role")).toBe("separator");
    expect(divider!.tabIndex).toBe(0);
    expect(divider!.getAttribute("aria-orientation")).toBe("vertical");
    expect(divider!.getAttribute("aria-valuenow")).toBe("200");
    expect(divider!.getAttribute("aria-valuemin")).toBe("24");
  });

  it("wires the tablist and tabs with ARIA and roving tabindex", () => {
    const tablist = host.querySelector('[role="tablist"]');
    expect(tablist?.getAttribute("aria-orientation")).toBe("horizontal");

    const tabs = host.querySelectorAll<HTMLElement>('[role="tab"]');
    expect(tabs).toHaveLength(2);

    const [b, c] = [...tabs];
    expect(b!.getAttribute("aria-selected")).toBe("true");
    expect(b!.tabIndex).toBe(0);
    expect(c!.getAttribute("aria-selected")).toBe("false");
    expect(c!.tabIndex).toBe(-1);
  });

  it("labels the active tabpanel by its tab", () => {
    const tab = host.querySelector<HTMLElement>('[role="tab"][data-panel="b"]');
    const panel = host.querySelector<HTMLElement>('[role="tabpanel"]');
    expect(panel?.getAttribute("aria-labelledby")).toBe(tab!.id);
  });

  it("mounts a content element for the active panels", () => {
    expect(host.querySelector('[data-panel="a"]')).not.toBeNull();
    expect(
      host.querySelector('.layouts-panel-content[data-panel="b"]'),
    ).not.toBeNull();
  });
});
