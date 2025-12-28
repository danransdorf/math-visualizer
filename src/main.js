import "./style.css";
import "./components/proof-visualizer.js";

// Ensure the root web component exists even if the HTML host is missing.
if (!document.querySelector("proof-visualizer-app")) {
  const app = document.createElement("proof-visualizer-app");
  document.body.appendChild(app);
}
