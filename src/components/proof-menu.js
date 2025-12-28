import { renderRichText } from "../utils/rich-text.js";
import { tagList } from "../utils/tags.js";

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

  parseContent(text) {
    return renderRichText(text);
  }

  getNumberTag(entry, fallback = null) {
    const primary = tagList(entry).find((tag) => tag.kind === "number");
    if (primary) return primary;
    const secondary = fallback ? tagList(fallback).find((tag) => tag.kind === "number") : null;
    return secondary || null;
  }

  formatTagLabel(tag) {
    if (!tag || !tag.value) return "";
    if (tag.kind === "chapter") return `Kap. ${tag.value}`;
    if (tag.kind === "number") return `#${tag.value}`;
    return tag.value;
  }

  renderTagRow(entry, fallback = null, { excludeKinds = [] } = {}) {
    const primaryTags = tagList(entry).filter((tag) => !excludeKinds.includes(tag.kind));
    const fallbackTags = fallback
      ? tagList(fallback).filter((tag) => !excludeKinds.includes(tag.kind))
      : [];
    const merged = [];
    const seen = new Set();

    [...primaryTags, ...fallbackTags].forEach((tag) => {
      const key = `${tag.kind}:${String(tag.value).toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(tag);
    });

    if (!merged.length) return "";
    const chips = merged
      .map(
        (tag) =>
          `<span class="tag-chip ${tag.kind}">${this.parseContent(this.formatTagLabel(tag))}</span>`,
      )
      .join("");
    return `<div class="tag-row">${chips}</div>`;
  }

  render() {
    if (!this.shadowRoot) return;
    const hasAnimations = this.animations.length > 0;
    const hasDefinitions = this.definitions.length > 0;
    const definitionCards = hasDefinitions
      ? this.definitions
          .map((def) => {
            const notation = def.notation
              ? `<span class="pill notation-chip">${this.parseContent(def.notation)}</span>`
              : "";
            const snippet = def.definition
              ? `<p class="definition-snippet">${this.parseContent(def.definition)}</p>`
              : "";
            const numberTag = this.getNumberTag(def);
            const numberLabel = numberTag ? `<span class="number-label">${this.parseContent(numberTag.value)}</span>` : "";
            const tagRow = this.renderTagRow(def, null, { excludeKinds: ["number"] });
            return `
              <article class="definition-card" data-open-definition="${def.id}" role="button" tabindex="0">
                <div class="header-row">
                  <h3 class="math-text title-with-number">
                    ${numberLabel}
                    ${this.parseContent(def.term || "Definition")}
                  </h3>
                  ${notation}
                </div>
                ${snippet}
                ${tagRow}
              </article>
            `;
          })
          .join("")
      : `<p class="notice">${this.definitionsLoading ? "Looking for definitions..." : "No definitions yet. Add some to data/definitions."}</p>`;
    const menuCards = hasAnimations
      ? this.animations
          .map((anim) => {
            const title = anim.proof?.title || anim.scene || "Theorem";
            const desc = anim.proof?.description || anim.source || "";
            const sectionLabel = anim.sections?.length
              ? `${anim.sections.length}&nbsp;krok${anim.sections.length === 1 ? "" : anim.sections.length >= 5 ? "ů" : "y"}`
              : "0&nbsp;kroků";
            const numberTag = this.getNumberTag(anim, anim.proof);
            const numberLabel = numberTag ? `<span class="number-label">${this.parseContent(numberTag.value)}</span>` : "";
            const tagRow = this.renderTagRow(anim, anim.proof, { excludeKinds: ["number"] });
            return `
              <article class="menu-card" data-open-animation="${anim.id}" role="button" tabindex="0">
                <div class="header-row">
                  <h3 class="title-with-number">
                    ${numberLabel}
                    ${title}
                  </h3>
                  <span class="pill">${sectionLabel}</span>
                </div>
                <div class="menu-desc">${this.parseContent(desc)}</div>
                ${tagRow}
              </article>
            `;
          })
          .join("")
      : `<p class="notice">${this.loading ? "Loading..." : "No theorems yet. Add Manim scenes and rerun the renderer."}</p>`;

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
        @import url("https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css");
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
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .definition-card {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          padding: 16px;
          display: grid;
          gap: 10px;
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .definition-snippet {
          margin: 0;
          color: color-mix(in srgb, var(--text-regular, #c3cfe0) 60%, transparent);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          overflow-wrap: anywhere;
          word-break: break-word;
          max-width: 100%;
          max-height: 3em;
        }
        .definition-snippet p { margin: 0; display: inline; }
        .definition-snippet .katex-display {
          margin: 0;
          display: inline;
        }
        .definition-snippet .katex-display > .katex { display: inline; }
        .math-text .katex-display { margin: 0; }
        .notation-chip {
          max-width: 200px;
          text-align: right;
          white-space: nowrap;
          word-break: keep-all;
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
          cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .header-row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
        .title-with-number {
          margin: 0 0 6px;
          color: #e2e8f0;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
        }
        .number-label {
          margin: 0;
          color: #94a3b8;
          font-size: 12px;
          letter-spacing: 0.04em;
          flex-shrink: 0;
          display: inline-flex;
        }
        .muted-label { margin: 0; color: #94a3b8; font-size: 12px; }
        .menu-desc {
          margin: 0;
          color: color-mix(in srgb, var(--text-regular, #c3cfe0) 60%, transparent);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          overflow-wrap: anywhere;
          word-break: break-word;
          max-width: 100%;
          max-height: 3em;
        }
        .menu-desc p { margin: 0; display: inline; }
        strong {
          color: color-mix(in srgb, var(--text-strong, #c3cfe0) 80%, transparent);
        }
        .pill {
          padding: 0;
          border-radius: 0;
          background: transparent;
          color: #9eb4d0;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          word-break: keep-all;
        }
        .notation-chip {
          max-width: 200px;
          text-align: right;
          white-space: nowrap;
          word-break: keep-all;
        }
        .tag-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 2px;
        }
        .tag-chip {
          padding: 0;
          border-radius: 0;
          background: transparent;
          border: none;
          color: #8aa0bb;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tag-chip::before {
          content: "•";
          color: rgba(148, 163, 184, 0.65);
        }
        .tag-chip.chapter {
          color: #b6a4ff;
        }
        .tag-chip.number {
          color: #9cd7b0;
        }
        .pill .katex-display {
          margin: 0;
          display: inline;
        }
        .pill .katex-display > .katex { display: inline; }
        .definition-card:hover,
        .menu-card:hover {
          border-color: rgba(14, 165, 233, 0.55);
          background: rgba(15, 23, 42, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 18px 32px rgba(8, 47, 73, 0.35);
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
          <h2>Definice</h2>
          <p class="section-subhead">Formální slovník</p>
        </div>
        ${definitionsStatus}
        <div class="definition-grid">
          ${definitionCards}
        </div>
      </div>
      <div class="section">
        <div class="section-head">
          <h2>Tvrzení</h2>
          <p class="section-subhead">Interaktivní důkazy</p>
        </div>
        ${status}
        <div class="menu-grid">
          ${menuCards}
        </div>
      </div>
    `;

    const handleActivate = (el, type) => {
      const id =
        type === "proof" ? el.dataset.openAnimation : el.dataset.openDefinition;
      if (!id) return;
      const eventName = type === "proof" ? "select-proof" : "select-definition";
      this.dispatchEvent(new CustomEvent(eventName, { detail: { id }, bubbles: true, composed: true }));
    };

    this.shadowRoot.querySelectorAll("[data-open-animation]").forEach((card) => {
      card.addEventListener("click", () => handleActivate(card, "proof"));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate(card, "proof");
        }
      });
    });

    this.shadowRoot.querySelectorAll("[data-open-definition]").forEach((card) => {
      card.addEventListener("click", () => handleActivate(card, "definition"));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate(card, "definition");
        }
      });
    });
  }
}

customElements.define("proof-menu", ProofMenu);
