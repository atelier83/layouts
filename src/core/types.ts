export type NodeId = string;
export type Orientation = "row" | "column";
export type Side = "left" | "right" | "top" | "bottom";

/** Sizing along the parent split's main axis. Leave `size` unset for a flexible node. */
export interface SizeConstraint {
  size?: number;
  min?: number;
  max?: number;
}

export interface SplitNode extends SizeConstraint {
  id: NodeId;
  type: "split";
  orientation: Orientation;
  children: NodeId[];
}

/** A region of panels. One panel renders chromeless; two or more get a tab bar. */
export interface GroupNode extends SizeConstraint {
  id: NodeId;
  type: "group";
  tabs: string[];
  activeTab: string;
}

export type LayoutNode = SplitNode | GroupNode;

export interface LayoutTree {
  root: NodeId;
  nodes: Record<NodeId, LayoutNode>;
}

/**
 * A panel's identity and behaviour. You own the content.
 * `fixed` panels don't drag, don't accept drops, and get no resize divider.
 */
export interface PanelDef {
  id: string;
  title?: string;
  fixed?: boolean;
}

export type MoveTarget = { groupId: NodeId; index?: number };

/**
 * Class names merged onto each rendered part, next to its base `layouts-*` class.
 * Pass scoped CSS Module classes or Tailwind utility strings. State (active,
 * dragging, orientation, drop zone) is exposed via `data-*` attributes, so style
 * variants with `[data-state="active"]` selectors or Tailwind's `data-[...]`.
 */
export interface LayoutClassNames {
  root?: string;
  split?: string;
  group?: string;
  tabbar?: string;
  tab?: string;
  panelContent?: string;
  divider?: string;
  dropOverlay?: string;
}
