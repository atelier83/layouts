# @atelier83/layouts

## 0.2.1

### Patch Changes

- Add `.layouts-panel-content` skin rules to `theme.css` — background and text colour are now themed out of the box without consumers needing to style the panel area themselves.

## 0.2.0

### Minor Changes

- Replaced `--layouts-*` colour tokens with a shared `--a83-*` palette. Both `@atelier83/layouts` and `@atelier83/timeline` now read the same token set, so one override themes everything. **Breaking change** — any overrides using the old `--layouts-*` tokens must be updated to `--a83-*`.
- Dark theme by default. Theme is a single static palette on `:root` with no built-in `prefers-color-scheme` or `data-theme` switching — light/dark/system is the app's responsibility.
- Added `.layouts-panel-content` skin rule (`background`, `color`) to `theme.css` so panel areas are themed out of the box.
- Active tab merges into its panel: `box-shadow` covers the tab bar's bottom border without any layout shift or text jump.

### Patch Changes

- Renamed `engine.destroy()` to `engine.dispose()` for consistency with `@atelier83/timeline`.
- Divider thickness reduced to 3 px (was 4 px).
- `prepublishOnly` script now uses `pnpm` instead of `npm run`.

## 0.1.0

### Minor Changes

- Initial release of `@atelier83/layouts`.
- Headless split-panel layout engine — vanilla TypeScript, zero runtime dependencies.
- Split tree with horizontal/vertical directions, nested groups, configurable min/max/initial sizes.
- Drag-to-dock: drag a panel and drop it beside any other group to rearrange the layout.
- Resize: drag dividers to resize panels; keyboard-accessible with arrow keys.
- Tabs: multiple panels can share a group; click tabs to switch, drag to reorder.
- Optional React bindings: `LayoutProvider`, `usePanel`.
- Default light/dark theme via `--layouts-*` CSS custom properties.
