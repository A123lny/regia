import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandChip } from "@/components/brand/brand-chip";

describe("BrandChip", () => {
  it("renders Lenny with orange dot", () => {
    render(<BrandChip brand="lenny" />);
    expect(screen.getByText("Lenny")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-lenny");
    expect(dot.style.backgroundColor).toBe("rgb(255, 107, 53)"); // #FF6B35
  });

  it("renders Stazione with blue dot", () => {
    render(<BrandChip brand="stazione" />);
    expect(screen.getByText("Stazione")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-stazione");
    expect(dot.style.backgroundColor).toBe("rgb(30, 95, 140)"); // #1E5F8C
  });

  it("renders Eni Cafè with brown dot", () => {
    render(<BrandChip brand="eni-cafe" />);
    expect(screen.getByText("Eni Cafè")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-eni-cafe");
    expect(dot.style.backgroundColor).toBe("rgb(140, 94, 30)"); // #8C5E1E
  });

  it("renders Officina with graphite dot", () => {
    render(<BrandChip brand="officina" />);
    expect(screen.getByText("Officina")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-officina");
    expect(dot.style.backgroundColor).toBe("rgb(62, 76, 89)"); // #3E4C59
  });
});
