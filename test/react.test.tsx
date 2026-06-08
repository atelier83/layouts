import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LayoutProvider, Panel } from "../src/react";

afterEach(cleanup);

const tabs = {
  group: [
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ],
} as const;

describe("React bindings", () => {
  it("portals panel content into the active region", () => {
    render(
      <LayoutProvider layout={tabs}>
        <Panel id="b">
          <p>Panel B body</p>
        </Panel>
      </LayoutProvider>,
    );
    expect(screen.getByText("Panel B body")).toBeTruthy();
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("keeps portal content through StrictMode double mounting", () => {
    render(
      <StrictMode>
        <LayoutProvider layout={tabs}>
          <Panel id="b">
            <p>Panel B body</p>
          </Panel>
        </LayoutProvider>
      </StrictMode>,
    );
    expect(screen.getByText("Panel B body")).toBeTruthy();
  });
});
