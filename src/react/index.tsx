import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import type { LayoutConfig } from "../core/config";
import { createLayout, type LayoutEngine } from "../core/engine";
import type { LayoutClassNames, LayoutTree } from "../core/types";

const LayoutContext = createContext<LayoutEngine | null>(null);

export interface LayoutProviderProps {
  /** Initial layout only. The engine is built once; call `engine.setLayout` to change it later. */
  layout: LayoutConfig;
  /** Class names merged onto each rendered part. See {@link LayoutClassNames}. */
  classNames?: LayoutClassNames;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function LayoutProvider({
  layout,
  classNames,
  style,
  children,
  className,
}: LayoutProviderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [engine] = useState(() => createLayout({ layout, classNames }));

  useEffect(() => {
    if (hostRef.current) engine.mount(hostRef.current);
    return () => engine.dispose();
  }, [engine]);

  return (
    <LayoutContext.Provider value={engine}>
      <div
        ref={hostRef}
        className={className}
        style={{ width: "100%", height: "100%", ...style }}
      />
      {children}
    </LayoutContext.Provider>
  );
}

export function useEngine(): LayoutEngine {
  const engine = useContext(LayoutContext);
  if (!engine)
    throw new Error("useEngine must be used within a <LayoutProvider>");
  return engine;
}

export function usePanel(panelId: string): HTMLElement {
  const engine = useEngine();
  return useMemo(() => engine.getPanelElement(panelId), [engine, panelId]);
}

export function useLayout(): { tree: LayoutTree; engine: LayoutEngine } {
  const engine = useEngine();
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
  return { tree: snapshot.tree, engine };
}

export function Panel({ id, children }: { id: string; children: ReactNode }) {
  return createPortal(children, usePanel(id));
}
