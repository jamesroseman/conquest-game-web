import { describe, it, expect } from "vitest";
import { statusLabel, titleCase } from "@/lib/format";

describe("titleCase", () => {
  it("converts snake_case to Title Case", () => {
    expect(titleCase("placing_troops")).toBe("Placing Troops");
  });

  it("handles empty input", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("statusLabel", () => {
  it("formats known statuses", () => {
    expect(statusLabel("lobby")).toBe("Lobby");
    expect(statusLabel("placing_troops")).toBe("Placing troops");
    expect(statusLabel("in_progress")).toBe("In progress");
  });

  it("falls back to title case for unknown statuses", () => {
    expect(statusLabel("some_new_status")).toBe("Some New Status");
  });
});
