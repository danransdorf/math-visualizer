import "./style.css";
import "./components/math-visualizer.js";

// Ensure the root web component exists even if the HTML host is missing.
if (!document.querySelector("math-visualizer-app")) {
  const app = document.createElement("math-visualizer-app");
  document.body.appendChild(app);
}
