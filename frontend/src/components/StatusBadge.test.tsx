import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["online", "Online"],
    ["offline", "Offline"],
    ["degraded", "Degraded"],
    ["unknown", "Unknown"],
  ])("renders the correct label for status=%s", (status, expectedLabel) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("falls back to 'Unknown' for an unrecognized status value", () => {
    render(<StatusBadge status="some-status-the-backend-might-add-later" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
