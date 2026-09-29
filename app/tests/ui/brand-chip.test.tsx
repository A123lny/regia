import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandChip } from "@/components/brand/brand-chip";

// Con RF-2.2 completamento (logo al posto del pallino colorato), i test
// verificano che il chip mostri nome + placeholder logo o logo caricato.

describe("BrandChip", () => {
  it("renders Lenny name", () => {
    render(<BrandChip brand="lenny" />);
    expect(screen.getByText("Lenny")).toBeDefined();
    expect(screen.getByTestId("brand-chip-lenny")).toBeDefined();
  });

  it("renders Stazione name", () => {
    render(<BrandChip brand="stazione" />);
    expect(screen.getByText("Stazione")).toBeDefined();
    expect(screen.getByTestId("brand-chip-stazione")).toBeDefined();
  });

  it("renders Eni Cafè name", () => {
    render(<BrandChip brand="eni-cafe" />);
    expect(screen.getByText("Eni Cafè")).toBeDefined();
    expect(screen.getByTestId("brand-chip-eni-cafe")).toBeDefined();
  });

  it("renders Officina name", () => {
    render(<BrandChip brand="officina" />);
    expect(screen.getByText("Officina")).toBeDefined();
    expect(screen.getByTestId("brand-chip-officina")).toBeDefined();
  });

  it("renders dynamic brand with custom name and logoUrl", () => {
    render(
      <BrandChip
        slug="custom"
        name="Custom Brand"
        color="#123456"
        logoUrl="https://example.com/logo.png"
      />,
    );
    expect(screen.getByText("Custom Brand")).toBeDefined();
    const img = screen.getByAltText("Logo Custom Brand");
    expect(img.getAttribute("src")).toBe("https://example.com/logo.png");
  });

  it("renders placeholder when logoUrl is null", () => {
    render(<BrandChip slug="empty" name="Empty Brand" color="#000000" logoUrl={null} />);
    expect(screen.getByText("Empty Brand")).toBeDefined();
    // Nessuna img → placeholder icona
    const imgs = screen.queryAllByRole("img");
    expect(imgs.length).toBe(0);
  });
});
