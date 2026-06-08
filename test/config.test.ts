import { describe, expect, it } from "vitest";

import { fromConfig } from "../src/core/config";
import type { GroupNode, LayoutTree, SplitNode } from "../src/core/types";

function node(tree: LayoutTree, id: string) {
  return tree.nodes[id]!;
}

function rootAs<T>(tree: LayoutTree): T {
  return node(tree, tree.root) as unknown as T;
}

describe("fromConfig", () => {
  it("wraps a lone panel in its own group", () => {
    const { tree, panels } = fromConfig({ id: "solo", title: "Solo" });
    const root = rootAs<GroupNode>(tree);
    expect(root.type).toBe("group");
    expect(root.tabs).toEqual(["solo"]);
    expect(root.activeTab).toBe("solo");
    expect(panels).toEqual([{ id: "solo", title: "Solo" }]);
  });

  it("splits behaviour onto the def and geometry onto the node", () => {
    const { tree, panels } = fromConfig({
      id: "hdr",
      title: "Header",
      fixed: true,
      size: 48,
    });
    const root = rootAs<GroupNode>(tree);
    expect(panels).toEqual([{ id: "hdr", title: "Header", fixed: true }]);
    expect(root.size).toBe(48);
    expect("fixed" in root).toBe(false);
  });

  it("preserves child order and copies only size fields", () => {
    const { tree, panels } = fromConfig({
      direction: "row",
      children: [{ id: "a", size: 100, min: 50, max: 200 }, { id: "b" }],
    });
    const root = rootAs<SplitNode>(tree);
    expect(root.type).toBe("split");
    expect(root.orientation).toBe("row");
    expect(root.children).toHaveLength(2);

    const a = node(tree, root.children[0]!) as GroupNode;
    const b = node(tree, root.children[1]!) as GroupNode;
    expect(a.tabs).toEqual(["a"]);
    expect(a.size).toBe(100);
    expect(a.min).toBe(50);
    expect(a.max).toBe(200);
    expect(b.size).toBeUndefined();
    expect(panels.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("reads inline group panels and honours the requested active tab", () => {
    const { tree, panels } = fromConfig({
      group: [
        { id: "p1", title: "One" },
        { id: "p2", title: "Two", fixed: true },
      ],
      active: "p2",
      size: 300,
    });
    const root = rootAs<GroupNode>(tree);
    expect(root.type).toBe("group");
    expect(root.tabs).toEqual(["p1", "p2"]);
    expect(root.activeTab).toBe("p2");
    expect(root.size).toBe(300);
    expect(panels).toEqual([
      { id: "p1", title: "One" },
      { id: "p2", title: "Two", fixed: true },
    ]);
  });

  it("falls back to the first tab when active is bogus", () => {
    const { tree } = fromConfig({
      group: [{ id: "p1" }, { id: "p2" }],
      active: "nope",
    });
    expect(rootAs<GroupNode>(tree).activeTab).toBe("p1");
  });
});
