import "./proof-menu.js";
import "./proof-viewer.js";
import "./definition-viewer.js";

class ProofVisualizerApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.animations = [];
    this.definitions = [];
    this.activeAnimationId = null;
    this.activeDefinitionId = null;
    this.animationsLoading = false;
    this.definitionsLoading = false;
    this.animationError = "";
    this.definitionsError = "";
    this.showMenu = true;
  }

  connectedCallback() {
    this.render();
    this.loadAnimations();
    this.loadDefinitions();
  }

  get activeAnimation() {
    return this.animations.find((anim) => anim.id === this.activeAnimationId) || null;
  }

  get activeDefinition() {
    return this.definitions.find((def) => def.id === this.activeDefinitionId) || null;
  }

  async loadAnimations() {
    this.animationsLoading = true;
    this.animationError = "";
    this.render();

    try {
      const response = await fetch("/proofs/manifest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No proof manifest found. Run `npm run build:proofs` to generate videos.");
      }
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      const normalized = this.normalizeAnimations(items);
      this.animations = normalized;
      if (!normalized.length) {
        this.animationError = "No videos in the manifest yet. Add Manim scenes in data/proofs and rebuild to render them.";
      }
    } catch (error) {
      this.animationError = error instanceof Error ? error.message : "Unable to load Manim manifest.";
    } finally {
      this.animationsLoading = false;
      this.render();
    }
  }

  async loadDefinitions() {
    this.definitionsLoading = true;
    this.definitionsError = "";
    this.render();

    try {
      const response = await fetch("/definitions/manifest.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No definitions found. Add definitions to data/definitions and rebuild.");
      }
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      this.definitions = items;
      if (!items.length) {
        this.definitionsError = "Definitions file is empty. Add items to data/definitions and rebuild.";
      }
    } catch (error) {
      this.definitionsError = error instanceof Error ? error.message : "Unable to load definitions.";
    } finally {
      this.definitionsLoading = false;
      this.render();
    }
  }

  normalizeAnimations(items) {
    return items.map((item) => {
      const sections = Array.isArray(item.sections) ? item.sections : [];
      const normalizedSections = sections
        .map((section, idx) => ({
          index: typeof section.index === "number" ? section.index : idx,
          id: section.id || `${item.id}__section_${idx}`,
          name: section.name || `Section ${idx + 1}`,
          file: section.file,
          url: section.url,
          description: section.description || section.name || "",
          isIntro: section.isIntro ?? section.is_intro ?? false,
        }))
        .sort((a, b) => a.index - b.index);

      return {
        ...item,
        sections: normalizedSections,
      };
    });
  }

  handleSelectProof(id) {
    this.activeAnimationId = id;
    this.activeDefinitionId = null;
    this.showMenu = false;
    this.render();
  }

  handleSelectDefinition(id) {
    this.activeDefinitionId = id;
    this.activeAnimationId = null;
    this.showMenu = false;
    this.render();
  }

  handleBackToMenu() {
    this.showMenu = true;
    this.activeAnimationId = null;
    this.activeDefinitionId = null;
    this.render();
  }

  render() {
    const menuView = this.showMenu || (!this.activeAnimation && !this.activeDefinition);
    if (menuView) {
      this.renderMenu();
    } else if (this.activeDefinition) {
      this.renderDefinitionViewer();
    } else {
      this.renderViewer();
    }
  }

  renderMenu() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: min(1200px, calc(100vw - 64px)); }
        .shell {
          background: linear-gradient(140deg, rgba(10, 16, 32, 0.94), rgba(9, 14, 26, 0.9));
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 28px 60px rgba(8, 47, 73, 0.28);
        }
        h1 { margin: 0 0 6px; color: #e2e8f0; font-size: clamp(26px,3vw,32px); }
        .lede { margin: 0 0 16px; color: #cbd5e1; line-height: 1.6; }
      </style>
      <section class="shell">
        <header>
          <h1>Knihovna důkazů</h1>
          <p class="lede">
            Vyber si důkaz ke zhlédnutí. Každý důkaz má formální část (v JSONu) a odpovídající Manim animace.
          </p>
        </header>
        <proof-menu></proof-menu>
      </section>
    `;

    const menuEl = this.shadowRoot.querySelector("proof-menu");
    if (menuEl) {
      menuEl.animations = this.animations;
      menuEl.definitions = this.definitions;
      menuEl.loading = this.animationsLoading;
      menuEl.definitionsLoading = this.definitionsLoading;
      menuEl.error = this.animationError;
      menuEl.definitionsError = this.definitionsError;
      menuEl.addEventListener("select-proof", (event) => {
        this.handleSelectProof(event.detail.id);
      });
      menuEl.addEventListener("select-definition", (event) => {
        this.handleSelectDefinition(event.detail.id);
      });
    }
  }

  renderViewer() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: min(1200px, calc(100vw - 64px)); }
      </style>
      <proof-viewer></proof-viewer>
    `;
    const viewerEl = this.shadowRoot.querySelector("proof-viewer");
    if (viewerEl) {
      viewerEl.animation = this.activeAnimation;
      viewerEl.addEventListener("back-to-menu", () => this.handleBackToMenu());
    }
  }

  renderDefinitionViewer() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: min(1200px, calc(100vw - 64px)); }
      </style>
      <definition-viewer></definition-viewer>
    `;

    const viewerEl = this.shadowRoot.querySelector("definition-viewer");
    if (viewerEl) {
      viewerEl.definition = this.activeDefinition;
      viewerEl.addEventListener("back-to-menu", () => this.handleBackToMenu());
    }
  }
}

customElements.define("proof-visualizer-app", ProofVisualizerApp);
