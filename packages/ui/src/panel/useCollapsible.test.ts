import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCollapsible } from "./useCollapsible";

describe("useCollapsible", () => {
  it("defaults to expanded (collapsed: false) unless overridden", () => {
    const { result } = renderHook(() => useCollapsible());
    expect(result.current.collapsed).toBe(false);
  });

  it("honors defaultCollapsed", () => {
    const { result } = renderHook(() => useCollapsible({ defaultCollapsed: true }));
    expect(result.current.collapsed).toBe(true);
  });

  it("toggle flips collapsed state", () => {
    const { result } = renderHook(() => useCollapsible());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it("collapse and expand set an explicit state", () => {
    const { result } = renderHook(() => useCollapsible());
    act(() => result.current.collapse());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.collapse());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.expand());
    expect(result.current.collapsed).toBe(false);
  });

  it("reset returns to the default", () => {
    const { result } = renderHook(() => useCollapsible({ defaultCollapsed: false }));
    act(() => result.current.collapse());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.reset());
    expect(result.current.collapsed).toBe(false);
  });
});
