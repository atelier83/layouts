import { describe, expect, it } from "vitest";

import { fromConfig } from "../src/core/config";
import { attach, moveTab, prune, resize, setActiveTab } from "../src/core/tree";
import type { GroupNode, LayoutTree, SplitNode } from "../src/core/types";

function groups(tree: LayoutTree): GroupNode[] {
  return Object.values(tree.nodes).filter(
    (n): n is GroupNode => n.type === "group",
  );
}

function groupOf(tree: LayoutTree, panelId: string): GroupNode {
  const g = groups(tree).find((n) => n.tabs.includes(panelId));
  if (!g) throw new Error(`no group holds panel "${panelId}"`);
  return g;
}

function countPanel(tree: LayoutTree, panelId: string): number {
  return groups(tree).reduce(
    (n, g) => n + g.tabs.filter((t) => t === panelId).length,
    0,
  );
}

function rootSplit(tree: LayoutTree): SplitNode {
  const n = tree.nodes[tree.root]!;
  if (n.type !== "split") throw new Error("root is not a split");
  return n;
}

function child(tree: LayoutTree, split: SplitNode, i: number): GroupNode {
  return tree.nodes[split.children[i]!] as GroupNode;
}

function row(): LayoutTree {
  return fromConfig({
    direction: "row",
    children: [
      { id: "a", size: 100, min: 50, max: 200 },
      { id: "b", size: 100, min: 50, max: 200 },
    ],
  }).tree;
}

describe("resize", () => {
  it("trades space between two sized neighbours and keeps their total", () => {
    const tree = row();
    const next = resize(tree, rootSplit(tree).id, 0, 30);
    const s = rootSplit(next);
    expect(child(next, s, 0).size).toBe(130);
    expect(child(next, s, 1).size).toBe(70);
  });

  it("stops at the tighter of the two bounds", () => {
    const tree = row();
    // a could reach 200, but b bottoms out at 50, so the transfer caps at 50
    const next = resize(tree, rootSplit(tree).id, 0, 1000);
    const s = rootSplit(next);
    expect(child(next, s, 0).size).toBe(150);
    expect(child(next, s, 1).size).toBe(50);
  });

  it("lets a flexible sibling absorb the change", () => {
    const tree = fromConfig({
      direction: "row",
      children: [{ id: "a", size: 100, min: 50, max: 300 }, { id: "b" }],
    }).tree;
    const next = resize(tree, rootSplit(tree).id, 0, 40);
    const s = rootSplit(next);
    expect(child(next, s, 0).size).toBe(140);
    expect(child(next, s, 1).size).toBeUndefined();
  });

  it("returns the same tree for an unknown split", () => {
    const tree = row();
    expect(resize(tree, "missing", 0, 30)).toBe(tree);
  });
});

describe("setActiveTab", () => {
  it("activates an existing tab", () => {
    const tree = fromConfig({ group: [{ id: "a" }, { id: "b" }], active: "a" }).tree;
    const g = groupOf(tree, "a");
    const next = setActiveTab(tree, g.id, "b");
    expect((next.nodes[g.id] as GroupNode).activeTab).toBe("b");
  });

  it("ignores a panel that isn't in the group", () => {
    const tree = fromConfig({ group: [{ id: "a" }, { id: "b" }] }).tree;
    const g = groupOf(tree, "a");
    expect(setActiveTab(tree, g.id, "zzz")).toBe(tree);
  });
});

describe("moveTab", () => {
  it("merges a panel into another region and prunes the empty source", () => {
    const tree = row();
    const dest = groupOf(tree, "b");
    const next = moveTab(tree, "a", { groupId: dest.id });
    const merged = groupOf(next, "a");
    expect(merged.tabs).toEqual(expect.arrayContaining(["a", "b"]));
    expect(merged.activeTab).toBe("a");
    expect(countPanel(next, "a")).toBe(1);
    expect(next.root).toBe(merged.id);
  });

  it("won't move a sole panel onto its own group", () => {
    const tree = fromConfig({ id: "solo" }).tree;
    const g = groupOf(tree, "solo");
    expect(moveTab(tree, "solo", { groupId: g.id })).toBe(tree);
  });
});

describe("attach", () => {
  it("docks left as the first child of a row split", () => {
    const tree = row();
    const next = attach(tree, "a", groupOf(tree, "b").id, "left");
    const s = rootSplit(next);
    expect(s.orientation).toBe("row");
    expect(child(next, s, 0).tabs).toEqual(["a"]);
    expect(child(next, s, 1).tabs).toEqual(["b"]);
  });

  it("docks bottom as the last child of a column split", () => {
    const tree = row();
    const next = attach(tree, "a", groupOf(tree, "b").id, "bottom");
    const s = rootSplit(next);
    expect(s.orientation).toBe("column");
    expect(child(next, s, 1).tabs).toEqual(["a"]);
  });

  it("keeps a single copy when pulling a tab out of its own group", () => {
    const tree = fromConfig({
      group: [{ id: "a" }, { id: "b" }],
      active: "a",
      size: 300,
      min: 200,
      max: 400,
    }).tree;
    const g = groupOf(tree, "a");
    const next = attach(tree, "a", g.id, "left");
    expect(countPanel(next, "a")).toBe(1);
    expect(countPanel(next, "b")).toBe(1);
    expect(groupOf(next, "a").size).toBe(150);
  });

  it("always sizes the dragged panel even when it started flexible", () => {
    const tree = fromConfig({
      direction: "row",
      children: [{ id: "a" }, { id: "b", size: 200, min: 100, max: 400 }],
    }).tree;
    const next = attach(tree, "a", groupOf(tree, "b").id, "left");
    expect(typeof groupOf(next, "a").size).toBe("number");
  });
});

describe("prune", () => {
  it("removes the empty group, collapses the split, and pushes size down", () => {
    const tree: LayoutTree = {
      root: "s",
      nodes: {
        s: {
          id: "s",
          type: "split",
          orientation: "row",
          children: ["g1", "g2"],
          size: 300,
          min: 100,
          max: 400,
        },
        g1: { id: "g1", type: "group", tabs: [], activeTab: "" },
        g2: { id: "g2", type: "group", tabs: ["x"], activeTab: "x" },
      },
    };
    const next = prune(tree);
    expect(next.root).toBe("g2");
    expect(next.nodes.g1).toBeUndefined();
    expect((next.nodes.g2 as GroupNode).size).toBe(300);
  });
});
