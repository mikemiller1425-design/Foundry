import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResizable } from "./useResizable";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function fakePointerEvent(clientX: number, clientY: number, pointerId = 1) {
  return {
    clientX,
    clientY,
    pointerId,
    currentTarget: {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function fakeKeyDown(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLElement>;
}

describe("useResizable", () => {
  beforeEach(() => {
    setViewport(1000, 1000);
  });

  it("starts at defaultSize and reports it via aria-valuenow", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }),
    );
    expect(result.current.size).toBe(15);
    expect(result.current.handleProps["aria-valuenow"]).toBe(15);
    expect(result.current.handleProps["aria-valuemin"]).toBe(8);
    expect(result.current.handleProps["aria-valuemax"]).toBe(30);
  });

  it("maps axis to the correct ARIA separator orientation", () => {
    const x = renderHook(() => useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }));
    expect(x.result.current.handleProps["aria-orientation"]).toBe("vertical");

    const y = renderHook(() => useResizable({ defaultSize: 20, min: 10, max: 35, axis: "y" }));
    expect(y.result.current.handleProps["aria-orientation"]).toBe("horizontal");
  });

  it("clamps setSize to [min, max]", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }),
    );
    act(() => result.current.setSize(1000));
    expect(result.current.size).toBe(30);
    act(() => result.current.setSize(-1000));
    expect(result.current.size).toBe(8);
  });

  it("reset returns to defaultSize", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }),
    );
    act(() => result.current.setSize(25));
    expect(result.current.size).toBe(25);
    act(() => result.current.reset());
    expect(result.current.size).toBe(15);
  });

  it("ArrowRight grows a non-inverted horizontal-axis panel; ArrowLeft shrinks it", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, step: 2, axis: "x" }),
    );
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("ArrowRight")));
    expect(result.current.size).toBe(17);
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("ArrowLeft")));
    expect(result.current.size).toBe(15);
  });

  it("ArrowRight shrinks an inverted horizontal-axis panel (e.g. a right-docked panel)", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 22, min: 12, max: 35, step: 2, axis: "x", invert: true }),
    );
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("ArrowRight")));
    expect(result.current.size).toBe(20);
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("ArrowLeft")));
    expect(result.current.size).toBe(22);
  });

  it("Home/End jump to min/max, Enter resets to default", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }),
    );
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("End")));
    expect(result.current.size).toBe(30);
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("Home")));
    expect(result.current.size).toBe(8);
    act(() => result.current.handleProps.onKeyDown(fakeKeyDown("Enter")));
    expect(result.current.size).toBe(15);
  });

  it("pointer drag resizes proportionally to viewport width on the x axis", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 0, max: 100, axis: "x" }),
    );
    act(() => result.current.handleProps.onPointerDown(fakePointerEvent(100, 0)));
    // viewport width is 1000px in this test; moving 100px right = +10 (percentage points).
    act(() => result.current.handleProps.onPointerMove(fakePointerEvent(200, 0)));
    expect(result.current.size).toBe(25);
    act(() => result.current.handleProps.onPointerUp(fakePointerEvent(200, 0)));
  });

  it("pointer drag is inverted for y-axis panels docked above the handle", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 20, min: 0, max: 100, axis: "y", invert: true }),
    );
    act(() => result.current.handleProps.onPointerDown(fakePointerEvent(0, 500)));
    // Dragging the handle up (negative deltaY) grows an inverted, above-docked panel.
    act(() => result.current.handleProps.onPointerMove(fakePointerEvent(0, 400)));
    expect(result.current.size).toBe(30);
  });
});
