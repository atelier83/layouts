import { uid } from "./config";
import type {
  GroupNode,
  LayoutNode,
  LayoutTree,
  MoveTarget,
  NodeId,
  Orientation,
  Side,
  SplitNode,
} from "./types";

const DEFAULT_MIN = 24;
const DEFAULT_PANEL_PX = 240;

function clampSize(node: LayoutNode, value: number): number {
  return Math.max(
    node.min ?? DEFAULT_MIN,
    Math.min(node.max ?? Infinity, value),
  );
}

// Biggest delta we can apply while a grows and b shrinks by the same amount
// without either leaving its bounds. Holding the pair's total fixed is what
// keeps the divider under the cursor instead of nudging everything else.
function jointDelta(a: LayoutNode, b: LayoutNode, delta: number): number {
  const aMin = a.min ?? DEFAULT_MIN,
    aMax = a.max ?? Infinity;
  const bMin = b.min ?? DEFAULT_MIN,
    bMax = b.max ?? Infinity;
  const lo = Math.max(aMin - a.size!, b.size! - bMax);
  const hi = Math.min(aMax - a.size!, b.size! - bMin);
  return Math.max(lo, Math.min(hi, delta));
}

export function resize(
  tree: LayoutTree,
  splitId: NodeId,
  index: number,
  delta: number,
): LayoutTree {
  const split = tree.nodes[splitId];
  if (split?.type !== "split") return tree;

  const aId = split.children[index];
  const bId = split.children[index + 1];
  if (!aId || !bId) return tree;
  const a = tree.nodes[aId]!;
  const b = tree.nodes[bId]!;

  const nodes = { ...tree.nodes };
  if (a.size != null && b.size != null) {
    const d = jointDelta(a, b, delta);
    nodes[aId] = { ...a, size: a.size + d };
    nodes[bId] = { ...b, size: b.size - d };
  } else if (a.size != null) {
    nodes[aId] = { ...a, size: clampSize(a, a.size + delta) };
  } else if (b.size != null) {
    nodes[bId] = { ...b, size: clampSize(b, b.size - delta) };
  } else {
    return tree;
  }
  return { ...tree, nodes };
}

export function setActiveTab(
  tree: LayoutTree,
  groupId: NodeId,
  panelId: string,
): LayoutTree {
  const group = tree.nodes[groupId];
  if (group?.type !== "group" || !group.tabs.includes(panelId)) return tree;
  return {
    ...tree,
    nodes: { ...tree.nodes, [groupId]: { ...group, activeTab: panelId } },
  };
}

function findGroupOfPanel(tree: LayoutTree, panelId: string): GroupNode | null {
  for (const node of Object.values(tree.nodes)) {
    if (node.type === "group" && node.tabs.includes(panelId)) return node;
  }
  return null;
}

function findParentSplit(tree: LayoutTree, childId: NodeId): SplitNode | null {
  for (const node of Object.values(tree.nodes)) {
    if (node.type === "split" && node.children.includes(childId)) return node;
  }
  return null;
}

function withoutPanel(group: GroupNode, panelId: string): GroupNode {
  const tabs = group.tabs.filter((t) => t !== panelId);
  return {
    ...group,
    tabs,
    activeTab: group.activeTab === panelId ? (tabs[0] ?? "") : group.activeTab,
  };
}

export function moveTab(
  tree: LayoutTree,
  panelId: string,
  target: MoveTarget,
): LayoutTree {
  const source = findGroupOfPanel(tree, panelId);
  const dest = tree.nodes[target.groupId];
  if (!source || dest?.type !== "group") return tree;
  if (source.id === target.groupId && source.tabs.length === 1) return tree;

  const nodes: Record<NodeId, LayoutNode> = { ...tree.nodes };
  nodes[source.id] = withoutPanel(source, panelId);

  const destGroup = nodes[target.groupId] as GroupNode;
  const tabs = destGroup.tabs.filter((t) => t !== panelId);
  const at =
    target.index == null
      ? tabs.length
      : Math.max(0, Math.min(target.index, tabs.length));
  tabs.splice(at, 0, panelId);
  nodes[target.groupId] = { ...destGroup, tabs, activeTab: panelId };

  return prune({ root: tree.root, nodes });
}

export function attach(
  tree: LayoutTree,
  panelId: string,
  targetGroupId: NodeId,
  side: Side,
): LayoutTree {
  const source = findGroupOfPanel(tree, panelId);
  const target = tree.nodes[targetGroupId];
  if (!source || target?.type !== "group") return tree;
  if (source.id === targetGroupId && source.tabs.length === 1) return tree;

  const nodes: Record<NodeId, LayoutNode> = { ...tree.nodes };
  let root = tree.root;

  nodes[source.id] = withoutPanel(source, panelId);

  // The dragged panel must land sized: a split of two flexible children leaves
  // the divider nothing to push against. Prefer its own footprint, else borrow
  // half the target (also halves when splitting its own region, so the leftover
  // panel survives).
  const sameGroup = source.id === targetGroupId;
  const halfTarget = target.size != null ? Math.round(target.size / 2) : null;
  const draggedSize = sameGroup
    ? (halfTarget ?? DEFAULT_PANEL_PX)
    : (source.size ?? halfTarget ?? DEFAULT_PANEL_PX);

  const dragged: GroupNode = {
    id: uid("group"),
    type: "group",
    tabs: [panelId],
    activeTab: panelId,
    size: draggedSize,
    min: source.min,
    max: source.max,
  };
  nodes[dragged.id] = dragged;

  const orientation: Orientation =
    side === "left" || side === "right" ? "row" : "column";
  const before = side === "left" || side === "top";
  const split: SplitNode = {
    id: uid("split"),
    type: "split",
    orientation,
    children: before ? [dragged.id, target.id] : [target.id, dragged.id],
    size: target.size,
    min: target.min,
    max: target.max,
  };
  nodes[split.id] = split;

  // Read target back from `nodes`, not the captured `target`, so a same-group
  // withoutPanel above isn't lost.
  nodes[target.id] = {
    ...(nodes[target.id] as GroupNode),
    size: undefined,
    min: undefined,
    max: undefined,
  };

  const parent = findParentSplit(tree, target.id);
  if (parent) {
    nodes[parent.id] = {
      ...parent,
      children: parent.children.map((c) => (c === target.id ? split.id : c)),
    };
  } else {
    root = split.id;
  }

  return prune({ root, nodes });
}

export function prune(tree: LayoutTree): LayoutTree {
  const nodes: Record<NodeId, LayoutNode> = {};

  function visit(id: NodeId): NodeId | null {
    const node = tree.nodes[id];
    if (!node) return null;

    if (node.type === "group") {
      if (node.tabs.length === 0) return null;
      nodes[id] = node;
      return id;
    }

    const children = node.children
      .map(visit)
      .filter((c): c is NodeId => c != null);
    if (children.length === 0) return null;
    if (children.length === 1) {
      const childId = children[0]!;
      const child = nodes[childId]!;
      nodes[childId] = {
        ...child,
        size: node.size ?? child.size,
        min: node.min ?? child.min,
        max: node.max ?? child.max,
      };
      return childId;
    }

    nodes[id] = { ...node, children };
    return id;
  }

  const root = visit(tree.root) ?? tree.root;
  return { root, nodes };
}
