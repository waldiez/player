import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { bootstrapDefaultPrefsFromAsset } from "./lib/moodDefaults";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
const root = rootElement;

async function start() {
    await bootstrapDefaultPrefsFromAsset();
    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

void start();
