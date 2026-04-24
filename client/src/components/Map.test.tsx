// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MapView } from "./Map";

let container: HTMLDivElement | null = null;

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

describe("MapView", () => {
  it("affiche un état désactivé lorsque la clé Google Maps est absente", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MapView />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Carte indisponible");
    expect(container.textContent).toContain("VITE_GOOGLE_MAPS_API_KEY");

    await act(async () => {
      root.unmount();
    });
  });
});
