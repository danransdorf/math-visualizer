import katex from "katex";

class DefinitionViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._definition = null;
    this.currentSectionIndex = 0;
  }

  connectedCallback() {
    this.render();
  }

  set definition(value) {
    this._definition = value;
    this.currentSectionIndex = 0;
    this.render();
  }

  get definition() {
    return this._definition;
  }

  get sections() {
    const secs = this.definition?.animation?.sections;
    return Array.isArray(secs) ? secs : [];
  }

  get hasSections() {
    return this.sections.length > 0;
  }

  clampSection(index) {
    if (!this.hasSections) return 0;
    return Math.min(Math.max(index, 0), this.sections.length - 1);
  }

  changeSection(delta) {
    this.currentSectionIndex = this.clampSection(this.currentSectionIndex + delta);
    this.render();
  }

  get activeSection() {
    if (!this.hasSections) return null;
    return this.sections[this.clampSection(this.currentSectionIndex)];
  }

  parseContent(text) {
    if (!text) return "";
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);

    return parts
      .map((part) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          try {
            return katex.renderToString(part.slice(2, -2), {
              trust: true,
              displayMode: true,
              throwOnError: false,
              output: "html",
            });
          } catch (e) {
            return part;
          }
        } else if (part.startsWith("$") && part.endsWith("$")) {
          try {
            return katex.renderToString(part.slice(1, -1), {
              trust: true,
              displayMode: false,
              throwOnError: false,
              output: "html",
            });
          } catch (e) {
            return part;
          }
        }
        return part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      })
      .join("");
  }

  render() {
    if (!this.shadowRoot) return;
    const def = this.definition;
    if (!def) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          .shell { padding: 24px; border-radius: 16px; border: 1px solid rgba(148,163,184,0.2); background: rgba(10,16,32,0.9); color: #e2e8f0; }
          .nav-btn { border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 999px; padding: 10px 14px; background: rgba(255, 255, 255, 0.02); color: #e2e8f0; font-weight: 700; cursor: pointer; }
        </style>
        <section class="shell">
          <p>Definition not found.</p>
          <button class="nav-btn" data-nav="back-menu">Zpět do menu</button>
        </section>
      `;
      this.bindEvents();
      return;
    }

    const notation = def.notation ? `<span class="pill">${def.notation}</span>` : "";
    const aliases =
      Array.isArray(def.alsoKnownAs) && def.alsoKnownAs.length
        ? def.alsoKnownAs.join(", ")
        : "";
    const aliasesRow = aliases
      ? `<p class="muted-label">Také známo jako: <strong>${aliases}</strong></p>`
      : "";
    const definitionHtml = this.parseContent(def.definition || "Tato definice zatím chybí.");
    const exampleHtml = def.example ? this.parseContent(def.example) : "";

    const activeSection = this.activeSection;
    const sectionCount = this.sections.length;
    const videoUrl = activeSection?.url || def.animation?.url || null;
    const videoLabel = activeSection?.name || def.animation?.name || def.term || "Animation";

    const sectionNav = this.hasSections
      ? `
        <div class="nav-row">
          <button class="nav-btn subtle" data-nav="prev-section" aria-label="Previous section" ${this.currentSectionIndex === 0 ? "disabled" : ""}>Previous</button>
          <div class="nav-label">
            <span class="nav-snippet">${videoLabel}</span>
            <span class="nav-count">${this.currentSectionIndex + 1}/${sectionCount}</span>
          </div>
          <div class="nav-actions">
            <button class="nav-btn accent" data-nav="next-section" aria-label="Next section" ${this.currentSectionIndex < sectionCount - 1 ? "" : "disabled"}>Next</button>
          </div>
        </div>
      `
      : "";

    const videoBody = videoUrl
      ? `
        <div class="player">
          <div class="video-frame">
            <video preload="metadata" src="${videoUrl}" aria-label="Definition animation for ${def.term}" muted autoplay playsinline></video>
          </div>
          <div class="player-meta">
            <div>
              <p class="muted-label">Term: ${def.term}</p>
              <p class="muted-label">${videoLabel}</p>
            </div>
            <div class="player-actions">
              <button class="nav-btn ghost" data-video-action="replay">Replay</button>
              <span class="pill">${def.animation?.quality ? `-q${def.animation.quality}` : "Clip"}</span>
            </div>
          </div>
        </div>
      `
      : `<p class="notice">No animation attached to this definition yet.</p>`;

    this.shadowRoot.innerHTML = `
      <style>
        @import url("https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css");
        :host { display: block; }
        .shell {
          background: linear-gradient(140deg, rgba(10, 16, 32, 0.94), rgba(9, 14, 26, 0.9));
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 28px 60px rgba(8, 47, 73, 0.28);
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        h1 {
          font-size: clamp(28px, 3vw, 36px);
          color: #e2e8f0;
          margin: 8px 0 6px;
        }
        .lede {
          margin: 0;
          color: #cbd5e1;
          max-width: 720px;
          line-height: 1.6;
        }
        .grid {
          display: grid;
          gap: 22px;
          grid-template-columns: 1fr 1.15fr;
          align-items: flex-start;
        }
        .progress-block {
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .definition-pane {
          display: grid;
          gap: 12px;
        }
        .card {
          padding: 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }
        .section-title {
          margin: 0 0 6px;
          color: #e2e8f0;
          font-size: 16px;
        }
        .definition-body {
          margin: 0;
          color: #e2e8f0;
          line-height: 1.7;
          font-size: 15px;
        }
        .muted-label {
          margin: 0;
          color: #94a3b8;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .nav-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
        }
        .nav-label {
          color: #e2e8f0;
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(148, 163, 184, 0.08);
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          line-height: 1.4;
        }
        .nav-snippet {
          color: #e2e8f0;
          display: inline-block;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nav-count {
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        .nav-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .nav-btn {
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 999px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          color: #e2e8f0;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: border-color 120ms ease, background 120ms ease, transform 120ms ease, color 120ms ease;
        }
        .nav-btn.accent {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1222;
          border-color: transparent;
        }
        .nav-btn.ghost {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          color: #e2e8f0;
          padding: 8px 12px;
        }
        .nav-btn.subtle {
          background: rgba(255, 255, 255, 0.02);
        }
        .nav-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        .nav-btn:not(:disabled):hover {
          transform: translateY(-1px);
          border-color: rgba(14, 165, 233, 0.7);
        }
        .visual-pane {
          display: grid;
          gap: 12px;
        }
        .visual-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }
        .scene-title {
          color: #e2e8f0;
          font-weight: 700;
          font-size: 16px;
        }
        .player {
          background: rgba(10, 18, 34, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 22px 40px rgba(7, 12, 24, 0.45);
        }
        .video-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          min-height: 360px;
          background: radial-gradient(120% 140% at 100% 0%, rgba(14, 165, 233, 0.08), transparent),
            linear-gradient(180deg, #0b1222, #0e172a);
        }
        .player video {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          object-fit: cover;
          mix-blend-mode: screen;
          filter: saturate(1.05);
        }
        .player-meta {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 14px 14px 16px;
        }
        .player-meta > div:first-child { min-width: 0; }
        .player-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
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
        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; }
        }
      </style>
      <section class="shell" aria-label="Definition viewer">
        <header class="top">
          <div>
            <p class="pill">Definition</p>
            <h1>${def.term || "Definition"}</h1>
            <p class="lede">${notation ? `${notation}` : ""}</p>
            ${aliasesRow}
          </div>
          <div class="progress-block">
            <button class="nav-btn ghost" data-nav="back-menu">Zpět do menu</button>
          </div>
        </header>

        ${sectionNav}

        <div class="grid">
          <article class="definition-pane">
            <div class="card">
              <p class="section-title">Popis</p>
              <div class="definition-body">${definitionHtml}</div>
            </div>
            ${exampleHtml ? `<div class="card"><p class="section-title">Příklad</p><div class="definition-body">${exampleHtml}</div></div>` : ""}
          </article>
          <aside class="visual-pane">
            <div class="visual-head">
              <p class="muted-label">Vizualizace</p>
              <div class="scene-title">${videoLabel}</div>
            </div>
            ${videoBody}
          </aside>
        </div>
      </section>
    `;

    this.bindEvents();
    this.bindVideoActions();
  }

  bindEvents() {
    const prev = this.shadowRoot.querySelector('[data-nav="prev-section"]');
    const next = this.shadowRoot.querySelector('[data-nav="next-section"]');
    const back = this.shadowRoot.querySelector('[data-nav="back-menu"]');

    if (prev) prev.addEventListener("click", () => this.changeSection(-1));
    if (next) next.addEventListener("click", () => this.changeSection(1));
    if (back) {
      back.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("back-to-menu", { bubbles: true, composed: true }));
      });
    }
  }

  bindVideoActions() {
    const video = this.shadowRoot.querySelector("video");
    const replayBtn = this.shadowRoot.querySelector('[data-video-action="replay"]');
    if (video && replayBtn) {
      replayBtn.addEventListener("click", () => {
        video.currentTime = 0;
        video.play();
      });
    }
  }
}

customElements.define("definition-viewer", DefinitionViewer);
