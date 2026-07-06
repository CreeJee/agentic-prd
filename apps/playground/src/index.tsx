import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { CartProvider } from "./cart";
import "./style.css";

// biome-ignore lint/style/noNonNullAssertion: 플레이그라운드 마운트 지점은 항상 존재
createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);
