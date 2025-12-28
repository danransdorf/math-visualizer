class ProofMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.animations = [];
    this.definitions = [];
    this.loading = false;
    this.definitionsLoading = false;
    this.error = "";
    this.definitionsError = "";
  }

  set animations(value) {
    this._animations = Array.isArray(value) ? value : [];
    this.render();
  }

  get animations() {
    return this._animations || [];
  }

  set definitions(value) {
    this._definitions = Array.isArray(value) ? value : [];
    this.render();
  }

  get definitions() {
    return this._definitions || [];
  }

  set loading(value) {
    this._loading = Boolean(value);
    this.render();
  }

  get loading() {
    return this._loading;
  }

  set definitionsLoading(value) {
    this._definitionsLoading = Boolean(value);
    this.render();
  }

  get definitionsLoading() {
    return this._definitionsLoading;
  }

  set error(value) {
    this._error = value || "";
    this.render();
  }

  get error() {
    return this._error || "";
  }

  set definitionsError(value) {
    this._definitionsError = value || "";
    this.render();
  }

  get definitionsError() {
    return this._definitionsError || "";
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this.shadowRoot) return;
    const hasAnimations = this.animations.length > 0;
    const hasDefinitions = this.definitions.length > 0;
    const definitionCards = hasDefinitions
      ? this.definitions
          .map((def) => {
            const aka = Array.isArray(def.alsoKnownAs) && def.alsoKnownAs.length
              ? `<p class="definition-meta">Also known as: ${def.alsoKnownAs.join(", ")}</p>`
              : "";
            const example = def.example
              ? `<p class="definition-meta">Example: ${def.example}</p>`
              : "";
            const notation = def.notation
              ? `<span class="pill">${def.notation}</span>`
              : "";
            const action = def.id
              ? `<div class="definition-actions"><button class="nav-btn accent" data-open-definition="${def.id}">Otevřít definici</button></div>`
              : "";
            return `
              <article class="definition-card">
                <div class="definition-title">
                  <h3>${def.term || "Definition"}</h3>
                  ${notation}
                </div>
                <p class="definition-body">${def.definition || ""}</p>
                ${aka}
                ${example}
                ${action}
              </article>
            `;
          })
          .join("")
      : `<p class="notice">${this.definitionsLoading ? "Looking for definitions..." : "No definitions yet. Add some to data/definitions."}</p>`;
    const menuCards = hasAnimations
      ? this.animations
          .map((anim) => {
            const title = anim.proof?.title || anim.scene || "Proof";
            const desc = anim.proof?.description || anim.source || "";
            const sectionLabel = anim.sections?.length
              ? `${anim.sections.length}&nbsp;krok${anim.sections.length === 1 ? "" : anim.sections.length >= 5 ? "ů" : "y"}`
              : "0&nbsp;kroků";
            return `
              <article class="menu-card">
                <div class="menu-top">
                  <div>
                    <p class="muted-label">${anim.scene || "Scene"}</p>
                    <h3>${title}</h3>
                    <p class="menu-desc">${desc}</p>
                  </div>
                  <span class="pill">${sectionLabel}</span>
                </div>
                <div class="menu-meta">
                  <span class="meta-chip">${anim.source || "data/proofs/" + anim.id}</span>
                  <span class="meta-chip">-q${anim.quality || "m"}</span>
                </div>
                <button class="nav-btn accent" data-open-animation="${anim.id}">Ukázat důkaz</button>
              </article>
            `;
          })
          .join("")
      : `<p class="notice">${this.loading ? "Loading..." : "No proofs yet. Add Manim scenes and rerun the renderer."}</p>`;

    const definitionsStatus = this.definitionsError
      ? `<p class="notice warning">${this.definitionsError}</p>`
      : "";

    const status = this.error
      ? `<p class="notice warning">${this.error}</p>`
      : this.loading
        ? `<p class="notice">Looking for /proofs/manifest.json ...</p>`
        : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .section {
          display: grid;
          gap: 12px;
          margin-bottom: 20px;
        }
        .section-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }
        .section-head h2 {
          margin: 0;
          color: #e2e8f0;
          font-size: 18px;
        }
        .section-subhead {
          margin: 0;
          color: #94a3b8;
          font-size: 13px;
        }
        .definition-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }
        .definition-card {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 8px;
        }
        .definition-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .definition-title h3 {
          margin: 0;
          color: #e2e8f0;
          font-size: 18px;
        }
        .definition-body {
          margin: 0;
          color: #cbd5e1;
          line-height: 1.5;
        }
        .definition-meta {
          margin: 0;
          color: #94a3b8;
          font-size: 13px;
        }
        .definition-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .menu-card {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          gap: 10px;
        }
        .menu-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        h3 { margin: 4px 0 6px; color: #e2e8f0; }
        .muted-label { margin: 0; color: #94a3b8; font-size: 12px; }
        .menu-desc { margin: 0; color: #cbd5e1; line-height: 1.5; }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
        }
        .menu-meta { display: flex; gap: 8px; flex-wrap: wrap; }
        .meta-chip {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(148,163,184,0.2);
          color: #94a3b8;
          font-size: 12px;
        }
        .nav-btn {
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          color: #e2e8f0;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 120ms ease, background 120ms ease, transform 120ms ease, color 120ms ease;
        }
        .nav-btn.accent {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1222;
          border-color: transparent;
        }
        .nav-btn:hover { transform: translateY(-1px); border-color: rgba(14, 165, 233, 0.7); }
        .notice {
          margin: 0;
          padding: 12px;
          border-radius: 12px;
          background: rgba(14, 165, 233, 0.1);
          border: 1px dashed rgba(14, 165, 233, 0.32);
          color: #bae6fd;
          font-size: 14px;
          line-height: 1.5;
        }
        .notice.warning {
          background: rgba(248, 113, 113, 0.12);
          border-color: rgba(248, 113, 113, 0.45);
          color: #fecdd3;
        }
      </style>
      <div class="section">
        <div class="section-head">
          <h2>Definitions</h2>
          <p class="section-subhead">Quick glossary for logic</p>
        </div>
        ${definitionsStatus}
        <div class="definition-grid">
          ${definitionCards}
        </div>
      </div>
      <div class="section">
        <div class="section-head">
          <h2>Proofs</h2>
          <p class="section-subhead">Interactive walkthroughs</p>
        </div>
        ${status}
        <div class="menu-grid">
          ${menuCards}
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-open-animation]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.openAnimation;
        this.dispatchEvent(new CustomEvent("select-proof", { detail: { id }, bubbles: true, composed: true }));
      });
    });
    this.shadowRoot.querySelectorAll("[data-open-definition]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.openDefinition;
        this.dispatchEvent(new CustomEvent("select-definition", { detail: { id }, bubbles: true, composed: true }));
      });
    });
  }
}

customElements.define("proof-menu", ProofMenu);
