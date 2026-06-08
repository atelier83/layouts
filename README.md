# layouts

Headless dockable panel layouts, the kind you get in VS Code, Photoshop, or Blender. You describe the layout as a nested split tree; the library positions the DOM containers, handles resizing, and runs drag-to-dock. It renders almost nothing of its own (a bare tab bar, and only when a region holds 2+ panels) and ships zero visual styling. You bring the panel content and the CSS.

## Install

```bash
pnpm add @atelier83/layouts
```

## Concepts

- **Split**: lays children out along `row` or `column` with draggable dividers.
- **Region** (group): a leaf holding one or more panels. One panel is chromeless; 2+ show a tab bar.
- **Panel**: your content plus an optional `fixed` flag. You get a DOM element and fill it.

## Config

Author a layout as a nested config. Identity and behaviour live inline on each panel, so there's no separate `panels` array. Omit `size` and the node flexes to fill what's left.

```ts
const layout = {
  direction: "column",
  children: [
    { id: "header", title: "Header", size: 48, fixed: true },
    {
      direction: "row",
      children: [
        { id: "sidebar", title: "Sidebar", size: 250, min: 160, max: 400 },
        { id: "content", title: "Content" }, // flexes
        { id: "inspector", title: "Inspector", size: 300, min: 200 },
      ],
    },
    { id: "terminal", title: "Terminal", size: 180, min: 80, max: 400 },
  ],
};
```

| field         | meaning                                              |
| ------------- | ---------------------------------------------------- |
| `id`          | panel identifier (used to fetch its content element) |
| `title`       | tab label                                            |
| `size`        | initial px size; omit for a flexible node            |
| `min` / `max` | resize clamps in px (defaults: 24 / unbounded)       |
| `fixed`       | no move, no drops, no divider                        |

Start panels pre-tabbed with a group:

```ts
{
  group: [
    { id: "panel1", title: "Panel 1" },
    { id: "panel2", title: "Panel 2" },
  ],
  active: "panel1",
  size: 300, min: 200, max: 400,
}
```

## Dragging

Press and hold a panel body to pick it up, then drag (tabs start dragging on the first move). Over a region you get five drop zones:

- **left / right**: dock side-by-side in a row split.
- **top / bottom**: stack in a column split.
- **middle**: merge in as a tab.

A `fixed` panel can't be dragged out, won't accept drops, and has no divider. Use it for chrome (headers, menu bars, icon rails). Empty regions collapse on their own.

## Vanilla

```ts
import { createLayout } from "@atelier83/layouts";

const engine = createLayout({ layout });

engine.getPanelElement("sidebar").innerHTML = `<div>...sidebar...</div>`;

engine.mount(document.getElementById("app")!);
```

## React

```tsx
import { LayoutProvider, Panel } from "@atelier83/layouts/react";

function App() {
  return (
    <LayoutProvider layout={layout} style={{ height: "100vh" }}>
      <Panel id="sidebar">
        <MyFileTree />
      </Panel>
      <Panel id="content">
        <MyEditor />
      </Panel>
    </LayoutProvider>
  );
}
```

`useLayout()` returns the reactive tree plus the engine (`setLayout`, `setActiveTab`, `moveTab`, ...).

## Styling

The library only emits structural CSS (flex, sizing, cursors) and the tab bar markup. Nothing is themed out of the box, so you have two options.

### Option 1: the default theme

Opt into a ready-made look:

```ts
import "@atelier83/layouts/theme.css";
```

Colours follow the OS. Force a mode with `data-theme="dark"` or `data-theme="light"` on the layout root or any ancestor (e.g. `<html data-theme="dark">`) — handy in React, where the root element is created for you.

Reskin by overriding tokens instead of rules:

```css
.layouts-root {
  --layouts-divider-size: 6px;
  --layouts-divider-color: #ccc;
  --layouts-tab-fg-active: #fff;
  --layouts-tab-bg-active: #111;
  --layouts-drop-accent: #2563eb;
}
```

Tokens: `--layouts-divider-size`, `--layouts-divider-color`, `--layouts-divider-color-active`, `--layouts-tabbar-bg`, `--layouts-tabbar-border`, `--layouts-tab-fg`, `--layouts-tab-fg-active`, `--layouts-tab-bg-active`, `--layouts-tab-border`, `--layouts-tab-padding`, `--layouts-tab-font-size`, `--layouts-drag-outline`, `--layouts-drop-bg`, `--layouts-drop-border`, `--layouts-drop-accent`, `--layouts-radius`.

### Option 2: style it yourself

Every rendered part carries a base `layouts-*` class plus `data-*` attributes for state. The three examples below all style the same small layout:

```ts
const layout = {
  direction: "row",
  children: [
    { id: "sidebar", title: "Sidebar", size: 240, min: 160 },
    {
      group: [
        { id: "editor", title: "Editor" },
        { id: "preview", title: "Preview" },
      ],
    },
  ],
};
```

**Plain CSS / SCSS** — a global stylesheet targets the base classes and state attributes:

```tsx
import "./layout.css";
<LayoutProvider layout={layout} style={{ height: "100vh" }}>
  {/* panels */}
</LayoutProvider>;
```

```css
/* layout.css */
.layouts-tabbar {
  background: #f4f4f5;
}
.layouts-tab {
  padding: 5px 14px;
  color: #71717a;
}
.layouts-tab[data-state="active"] {
  color: #18181b;
  background: #fff;
}
.layouts-divider {
  background: #e4e4e7;
}
.layouts-divider[data-active]:hover {
  background: #c4c4cc;
}
.layouts-drop-overlay {
  border: 1px dashed rgba(0, 0, 0, 0.25);
}
.layouts-drop-overlay[data-zone="middle"] {
  border-style: solid;
  border-color: #2563eb;
}
```

**CSS Modules** — the parts are created inside the engine, so pass scoped classes through `classNames`. Style state with `data-*` inside the module:

```tsx
import s from "./layout.module.css";

<LayoutProvider
  layout={layout}
  classNames={{ tabbar: s.tabbar, tab: s.tab, divider: s.divider }}
/>;
```

```css
/* layout.module.css */
.tabbar {
  background: #f4f4f5;
}
.tab {
  padding: 5px 14px;
  color: #71717a;
}
.tab[data-state="active"] {
  color: #18181b;
  background: #fff;
}
.divider {
  background: #e4e4e7;
}
.divider[data-active]:hover {
  background: #c4c4cc;
}
```

**Tailwind** — utility strings, with `data-[...]` variants for state:

```tsx
<LayoutProvider
  layout={layout}
  classNames={{
    tabbar: "bg-zinc-100",
    tab: "px-3 py-1 text-zinc-500 data-[state=active]:text-zinc-900 data-[state=active]:bg-white",
    divider: "bg-zinc-200 data-[active]:hover:bg-zinc-300",
    dropOverlay:
      "border border-dashed border-black/25 data-[zone=middle]:border-solid data-[zone=middle]:border-blue-600",
  }}
/>
```

`classNames` slots: `root`, `split`, `group`, `tabbar`, `tab`, `panelContent`, `divider`, `dropOverlay`. (Vanilla: pass the same map to `createLayout({ layout, classNames })`.)

State hooks available on each part:

| part                     | base class               | state attributes                                 |
| ------------------------ | ------------------------ | ------------------------------------------------ |
| split container          | `.layouts-split`         | `[data-orientation="row\|column"]`               |
| region                   | `.layouts-group`         | `[data-dragging]` while dragged from             |
| tab bar (2+ panels)      | `.layouts-tabbar`        | —                                                |
| tab button               | `.layouts-tab`           | `[data-state="active\|inactive"]`                |
| panel content (you fill) | `.layouts-panel-content` | —                                                |
| divider                  | `.layouts-divider`       | `[data-orientation]`, `[data-active]`            |
| drop highlight           | `.layouts-drop-overlay`  | `[data-zone="left\|right\|top\|bottom\|middle"]` |

## Accessibility

Tabs render as real `<button>`s with `role="tab"` / `aria-selected` inside a `role="tablist"`, and the active panel is a `role="tabpanel"` labelled by its tab. Tabs use a roving `tabindex`: focus the strip, then `ArrowLeft` / `ArrowRight` move (and activate) tabs, with `Home` / `End` jumping to the ends.

Resizable dividers are `role="separator"` with `aria-orientation` and `aria-valuenow` / `aria-valuemin` / `aria-valuemax`. They're focusable and resize with the arrow keys (`ArrowLeft` / `ArrowRight` for vertical splits, `ArrowUp` / `ArrowDown` for horizontal ones).

The theme adds a `:focus-visible` ring and honours `prefers-reduced-motion`. Drag-to-dock remains pointer-only; keyboard docking (moving a panel between regions) is the one gesture still on the roadmap.

## License

MIT
