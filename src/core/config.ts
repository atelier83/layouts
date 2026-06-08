import type {
  LayoutNode,
  LayoutTree,
  NodeId,
  Orientation,
  PanelDef,
  SizeConstraint,
} from "./types";

let counter = 0;
export function uid(prefix: string): string {
  return `${prefix}_${++counter}`;
}

/** Authoring config: a split, a single panel, or a pre-tabbed group. */
export type LayoutConfig = ConfigSplit | ConfigPanel | ConfigGroup;

export interface ConfigSplit extends SizeConstraint {
  direction: Orientation;
  children: LayoutConfig[];
}

export interface ConfigPanel extends PanelDef, SizeConstraint {}

export interface ConfigGroup extends SizeConstraint {
  group: PanelDef[];
  active?: string;
}

function pickSize({ size, min, max }: SizeConstraint): SizeConstraint {
  const out: SizeConstraint = {};
  if (size != null) out.size = size;
  if (min != null) out.min = min;
  if (max != null) out.max = max;
  return out;
}

/** Expand authoring config into a normalized tree plus the panel defs it declares. */
export function fromConfig(config: LayoutConfig): {
  tree: LayoutTree;
  panels: PanelDef[];
} {
  const nodes: Record<NodeId, LayoutNode> = {};
  const panels: PanelDef[] = [];

  function build(c: LayoutConfig): NodeId {
    if ("direction" in c) {
      const id = uid("split");
      nodes[id] = {
        id,
        type: "split",
        orientation: c.direction,
        children: c.children.map(build),
        ...pickSize(c),
      };
      return id;
    }

    if ("group" in c) {
      const id = uid("group");
      const tabs = c.group.map((p) => p.id);
      panels.push(...c.group);
      nodes[id] = {
        id,
        type: "group",
        tabs,
        activeTab: c.active && tabs.includes(c.active) ? c.active : tabs[0]!,
        ...pickSize(c),
      };
      return id;
    }

    const { id: panelId, title, fixed, ...size } = c;
    panels.push({
      id: panelId,
      ...(title != null && { title }),
      ...(fixed != null && { fixed }),
    });
    const id = uid("group");
    nodes[id] = {
      id,
      type: "group",
      tabs: [panelId],
      activeTab: panelId,
      ...pickSize(size),
    };
    return id;
  }

  return { tree: { root: build(config), nodes }, panels };
}
