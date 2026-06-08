import { describe, expect, it } from "vitest";

import { zoneAt, zoneRect, type Rect } from "../src/core/dnd";

const r: Rect = { left: 0, top: 0, width: 100, height: 100 };

describe("zoneAt", () => {
  it("returns middle for the centre", () => {
    expect(zoneAt(r, 50, 50)).toBe("middle");
  });

  it("returns left for the left strip", () => {
    expect(zoneAt(r, 5, 50)).toBe("left");
  });

  it("returns right for the right strip", () => {
    expect(zoneAt(r, 95, 50)).toBe("right");
  });

  it("returns top for the top strip", () => {
    expect(zoneAt(r, 50, 5)).toBe("top");
  });

  it("returns bottom for the bottom strip", () => {
    expect(zoneAt(r, 50, 95)).toBe("bottom");
  });

  it("prefers left/right over top/bottom in corners", () => {
    expect(zoneAt(r, 5, 5)).toBe("left");
    expect(zoneAt(r, 95, 5)).toBe("right");
    expect(zoneAt(r, 5, 95)).toBe("left");
    expect(zoneAt(r, 95, 95)).toBe("right");
  });

  it("respects a non-zero origin", () => {
    const off: Rect = { left: 200, top: 100, width: 100, height: 100 };
    expect(zoneAt(off, 250, 150)).toBe("middle");
    expect(zoneAt(off, 205, 150)).toBe("left");
    expect(zoneAt(off, 295, 150)).toBe("right");
  });
});

describe("zoneRect", () => {
  it("middle covers the whole rect", () => {
    expect(zoneRect(r, "middle")).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });

  it("left/right strips hug their edges", () => {
    const left = zoneRect(r, "left");
    expect(left.left).toBe(0);
    expect(left.width).toBeCloseTo(28);
    expect(left.height).toBe(100);

    const right = zoneRect(r, "right");
    expect(right.left).toBeCloseTo(72);
    expect(right.width).toBeCloseTo(28);
    expect(right.height).toBe(100);
  });

  it("top/bottom strips hug their edges", () => {
    const top = zoneRect(r, "top");
    expect(top.top).toBe(0);
    expect(top.width).toBe(100);
    expect(top.height).toBeCloseTo(28);

    const bottom = zoneRect(r, "bottom");
    expect(bottom.top).toBeCloseTo(72);
    expect(bottom.width).toBe(100);
    expect(bottom.height).toBeCloseTo(28);
  });
});
