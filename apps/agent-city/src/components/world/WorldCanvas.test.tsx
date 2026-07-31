import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldCanvas } from "./WorldCanvas";

describe("WorldCanvas", () => {
  it("mounts an empty R3F canvas without throwing", () => {
    const { container } = render(<WorldCanvas />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
