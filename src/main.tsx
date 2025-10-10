import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BarcodeScannerProvider } from "./contexts/BarcodeScannerContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BarcodeScannerProvider>
      <App />
    </BarcodeScannerProvider>
  </React.StrictMode>
);
