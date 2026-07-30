import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page (FBL-004 boot smoke test)", () => {
  it("renders without throwing", () => {
    expect(() => Home()).not.toThrow();
  });

  it("has no meaningful content yet, by design", () => {
    expect(Home()).toBeNull();
  });
});
