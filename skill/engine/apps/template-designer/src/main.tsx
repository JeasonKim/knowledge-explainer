import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TemplateEffectDebugger } from "./template-designer";
import "./template-designer.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TemplateEffectDebugger />
  </StrictMode>
);
