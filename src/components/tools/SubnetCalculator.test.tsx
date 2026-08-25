import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubnetCalculator from "./SubnetCalculator";

// Note: no @testing-library/jest-dom here — see vitest.setup.ts for why.
// Plain DOM assertions (throwing getByText / null-checking queryByText) are
// used instead of .toBeInTheDocument().

describe("SubnetCalculator", () => {
  it("shows the default 10.0.0.0/24 breakdown on mount", () => {
    render(<SubnetCalculator />);
    expect(screen.getByText("10.0.0.0")).toBeTruthy(); // network address
    expect(screen.getByText("10.0.0.255")).toBeTruthy(); // broadcast
    expect(screen.getByText("254")).toBeTruthy(); // usable hosts
  });

  it("recomputes live as the user types a new CIDR", async () => {
    const user = userEvent.setup();
    render(<SubnetCalculator />);
    const input = screen.getByPlaceholderText("10.0.0.0/24");
    await user.clear(input);
    await user.type(input, "192.168.1.0/28");

    expect(screen.getByText("192.168.1.0")).toBeTruthy();
    expect(screen.getByText("192.168.1.15")).toBeTruthy(); // broadcast
    expect(screen.getByText("14")).toBeTruthy(); // usable hosts
  });

  it("shows a clear error for invalid input instead of stale results", async () => {
    const user = userEvent.setup();
    render(<SubnetCalculator />);
    const input = screen.getByPlaceholderText("10.0.0.0/24");
    await user.clear(input);
    await user.type(input, "not-a-cidr");

    expect(screen.getByText(/CIDR form/i)).toBeTruthy();
    expect(screen.queryByText("Network address")).toBeNull();
  });
});
