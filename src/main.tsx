import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../app/globals.css";

const root = document.getElementById("root")!;
const fixture = import.meta.env.DEV && new URLSearchParams(window.location.search).get("fixture") === "ux";

if (fixture) {
  void import("../app/ux-fixture").then(({ UxFixture }) => {
    createRoot(root).render(
      <StrictMode>
        <UxFixture />
      </StrictMode>,
    );
  });
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
