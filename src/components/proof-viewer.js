import katex from "katex";

// If you are using a bundler (Vite/Webpack) that handles assets, 
// you might ensure the CSS/Fonts are in your build output.
// For Shadow DOM, we often still need to reference the CSS file via URL 
// or inject the CSS string directly.

class ProofViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.animation = null;
    this.currentSectionIndex = 0;
    this.hasStarted = false;
    this.autoplayTimer = null;
    this.autoplayActive = false;
    this.autoplayVideo = null;
    this.autoplayEndListener = null;
    // Removed: this.katexLoaded tracking (library is now imported)
  }

  set animation(value) {
    this.stopAutoplay(false);
    this._animation = value;
    this.currentSectionIndex = 0;
    this.hasStarted = false;
    this.render();
  }

  get animation() {
    return this._animation;
  }

  connectedCallback() {
    this.loadGlobalStyles()
      .then(() => {
        // 2. Only render once CSS is confirmed ready
        this.render(); 
      })
      .catch(err => {
        console.error("KaTeX CSS failed to load:", err);
        // Render anyway so text appears (even if ugly)
        this.render();
      });
  }

  disconnectedCallback() {
    this.stopAutoplay(false);
  }

  get proofSteps() {
    const steps = this.animation?.proof?.steps;
    if (Array.isArray(steps)) return steps;
    return [];
  }

  get theoremStatement() {
    return (
      this.animation?.proof?.theorem ||
      this.animation?.proof?.statement ||
      this.proofSteps[0]?.statement ||
      ""
    );
  }

  get sections() {
    return Array.isArray(this.animation?.sections) ? this.animation.sections : [];
  }

  get introSectionIndex() {
    if (!this.sections.length) return -1;
    const flaggedIndex = this.sections.findIndex(
      (section) => section?.isIntro === true || section?.is_intro === true,
    );
    if (flaggedIndex >= 0) return flaggedIndex;
    // Default: first section is the intro clip for the start screen.
    return 0;
  }

  get introSection() {
    if (this.introSectionIndex < 0) return null;
    return this.sections[this.introSectionIndex] || null;
  }

  get playableSections() {
    if (!this.sections.length) return [];
    if (this.introSectionIndex < 0) return this.sections;
    return this.sections.filter((_, idx) => idx !== this.introSectionIndex);
  }

  get stepCount() {
    const stepLen = this.proofSteps.length;
    const playableLen = this.playableSections.length;
    if (stepLen && playableLen) return Math.min(stepLen, playableLen);
    return stepLen || playableLen || 0;
  }

  clampIndex(index) {
    if (this.stepCount <= 0) return 0;
    const clampedIndex = Math.min(Math.max(index, 0), Math.max(0, this.stepCount - 1));
    return clampedIndex;
  }

  setSection(index) {
    const clampedIndex = this.clampIndex(index);
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.currentSectionIndex = clampedIndex;
      this.render();
      return;
    }
    if (clampedIndex === this.currentSectionIndex) return;
    this.currentSectionIndex = clampedIndex;
    this.render();
  }

  changeSection(delta) {
    this.setSection(this.currentSectionIndex + delta);
  }

  startProof(index = 0) {
    const clampedIndex = this.clampIndex(index);
    this.hasStarted = true;
    this.currentSectionIndex = clampedIndex;
    this.render();
  }

  getActiveSection() {
    if (!this.playableSections.length && !this.sections.length) return null;

    if (!this.hasStarted) {
      return this.introSection || this.playableSections[0] || this.sections[0] || null;
    }

    const playable = this.playableSections;
    if (!playable.length) return null;
    const safeIndex = Math.min(Math.max(this.currentSectionIndex, 0), playable.length - 1);
    return playable[safeIndex];
  }

  get progress() {
    const count = this.stepCount;
    if (!count || !this.hasStarted) return 0;
    return Math.round(((this.currentSectionIndex + 1) / count) * 100);
  }

  clearAutoplayTimer() {
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  detachAutoplayListener() {
    if (this.autoplayVideo && this.autoplayEndListener) {
      this.autoplayVideo.removeEventListener("ended", this.autoplayEndListener);
    }
    this.autoplayVideo = null;
    this.autoplayEndListener = null;
  }

  stopAutoplay(shouldRender = true) {
    const wasActive = this.autoplayActive;
    this.autoplayActive = false;
    this.clearAutoplayTimer();
    this.detachAutoplayListener();
    if (wasActive && shouldRender) this.render();
  }

  startAutoplay() {
    if (!this.stepCount) return;
    this.autoplayActive = true;
    this.clearAutoplayTimer();
    this.detachAutoplayListener();
    if (!this.hasStarted) {
      this.startProof(0);
    } else {
      this.render();
    }
  }

  toggleAutoplay() {
    if (this.autoplayActive) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  queueAutoplayTick() {
    this.clearAutoplayTimer();
    this.detachAutoplayListener();
    if (!this.autoplayActive) return;

    const scheduleAdvance = () => {
      if (this.currentSectionIndex >= this.stepCount - 1) {
        this.stopAutoplay(true);
        return;
      }
      this.clearAutoplayTimer();
      this.autoplayTimer = setTimeout(() => {
        if (!this.autoplayActive) return;
        if (this.currentSectionIndex >= this.stepCount - 1) {
          this.stopAutoplay(true);
          return;
        }
        this.changeSection(1);
      }, 2000);
    };

    const video = this.shadowRoot?.querySelector("video");
    if (!video) {
      scheduleAdvance();
      return;
    }

    this.autoplayVideo = video;
    this.autoplayEndListener = () => {
      scheduleAdvance();
    };

    if (video.ended) {
      scheduleAdvance();
      return;
    }

    video.addEventListener("ended", this.autoplayEndListener, { once: true });
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }
  }

  /**
   * Safe Text Parser
   * 1. Splits text by $...$ and $$...$$
   * 2. Renders Math using bundled KaTeX
   * 3. Escapes regular text
   */
  parseContent(text) {
    if (!text) return "";
    
    // Split logic: Capture content inside delimiters
    // Group 1: $$...$$ (Display), Group 2: $...$ (Inline)
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+\$)/g);

    return parts.map(part => {
      // Handle Display Mode $$...$$
      if (part.startsWith('$$') && part.endsWith('$$')) {
        try {
          return katex.renderToString(part.slice(2, -2), { 
            trust: true,
            displayMode: true, 
            throwOnError: false,
            output: 'html' // Use HTML output to avoid needing MathML fonts if problematic
          });
        } catch (e) { return part; }
      } 
      // Handle Inline Mode $...$
      else if (part.startsWith('$') && part.endsWith('$')) {
        try {
          return katex.renderToString(part.slice(1, -1), { 
            trust: true,
            displayMode: false, 
            throwOnError: false,
            output: 'html'
          });
        } catch (e) { return part; }
      } 
      // Handle Text
      else {
        return part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
    }).join('');
  }

  loadGlobalStyles() {
    return new Promise((resolve, reject) => {
      // Use the version matching your installed package, or fallback to latest
      const version = (typeof katex !== "undefined" && katex.version) ? katex.version : "0.16.10";
      const url = `https://cdn.jsdelivr.net/npm/katex@${version}/dist/katex.min.css`;
      
      // Store for use in Shadow DOM
      this.katexUrl = url;

      // Check if it's already there
      if (document.querySelector(`link[href="${url}"]`)) {
        return resolve();
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.crossOrigin = "anonymous"; // Important for fonts
      
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load KaTeX CSS from ${url}`));
      console.log("styles loaded")

      document.head.appendChild(link);
    });
  }

  render() {
    if (!this.shadowRoot) return;
    const proofSteps = this.proofSteps;
    const sectionCount = this.stepCount;
    const hasSteps = sectionCount > 0;
    const hasStarted = this.hasStarted && hasSteps;
    const showStartScreen = !hasStarted;
    const activeSection = this.getActiveSection();
    const title = this.animation?.proof?.title || this.animation?.scene || "Proof";
    const description =
      this.animation?.proof?.description ||
      this.animation?.source ||
      "This proof has no description yet.";
    const theoremHtml = this.parseContent(
      this.theoremStatement || "Tento důkaz zatím nemá formulovaný výrok.",
    );
    const startNote = proofSteps.length > 0
      ? "Až klikneš na „Spustit důkaz“, přehrajeme úvodní animaci a pak první krok."
      : "Přidej formální kroky do .proof.json, aby bylo co přehrát.";

    const transcript =
      hasStarted && proofSteps.length > 0
        ? proofSteps
            .slice(0, Math.min(this.currentSectionIndex + 1, proofSteps.length))
            .map((proofStep, idx, arr) => {
              const isActive = idx === Math.min(arr.length - 1, this.currentSectionIndex);
              const stepStatement = this.parseContent(proofStep?.statement || "This section is pending a description.");
              return `<span class="flow-sentence ${isActive ? "active" : ""}">${stepStatement}</span>`;
            })
            .join(" ")
        : `
          <div class="start-card">
            <p class="eyebrow">Theorem to prove</p>
            <h2 class="start-title">${title}</h2>
            <div class="theorem-statement">${theoremHtml}</div>
            <p class="start-note">${startNote}</p>
          </div>
        `;

    const stepMarkers =
      sectionCount > 0
        ? `
            <div class="step-markers ${showStartScreen ? "locked" : ""}" role="list">
              ${Array.from({ length: sectionCount })
                .map(
                  (_, idx) => `
                    <button
                      class="marker ${hasStarted && idx === this.currentSectionIndex ? "active" : ""}"
                      data-section-index="${idx}"
                      aria-label="Jump to step ${idx + 1}"
                      ${showStartScreen ? "tabindex='-1' aria-disabled='true'" : ""}
                    >
                      <span>${idx + 1}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>
          `
        : "";

    const navSnippet = hasStarted
      ? proofSteps[this.currentSectionIndex]?.statement || activeSection?.description || activeSection?.name || "Step"
      : this.theoremStatement || "Ready to start";
    const navLabel = sectionCount
      ? `<span class="nav-snippet">${this.parseContent(navSnippet)}</span><span class="nav-count">${hasStarted ? `${this.currentSectionIndex + 1}/${sectionCount}` : `${sectionCount} krok${sectionCount === 1 ? "" : sectionCount >= 5 ? "ů" : "y"} připraveno`}</span>`
      : `<span class="nav-snippet">Žádné kroky zatím nejsou v JSONu</span>`;

    const activeSectionName = activeSection?.name || (showStartScreen ? "Intro" : "Section");
    const videoBody =
      activeSection && activeSection.url
        ? `
            <div class="player">
              <div class="video-frame">
                <video key="${activeSection.id}" preload="metadata" src="${activeSection.url}" aria-label="Manim section ${activeSectionName}" muted autoplay playsinline></video>
              </div>
              <div class="player-meta">
                <div>
                  <p class="muted-label">Scene: ${this.animation?.scene || "Untitled scene"}</p>
                  <p class="muted-label">Section: ${activeSectionName}${showStartScreen ? " (intro)" : ""}</p>
                </div>
                <div class="player-actions">
                  <button class="nav-btn ghost" data-video-action="replay">Replay</button>
                  <span class="pill">${this.animation?.quality ? `-q${this.animation.quality}` : "Section clip"}</span>
                </div>
              </div>
            </div>
          `
        : `<p class="notice">No section video available. Add \`next_section()\` calls and rerun \`npm run build:proofs\`.</p>`;

    const navRow = hasStarted && hasSteps
      ? `
        <div class="nav-row">
          <button class="nav-btn subtle" data-nav="prev-section" aria-label="Previous step" ${this.currentSectionIndex === 0 ? "disabled" : ""}>Previous</button>
          <div class="nav-label">${navLabel}</div>
          <div class="nav-actions">
            <button class="nav-btn ghost" data-nav="restart-proof">Restart</button>
            <button class="nav-btn ghost" data-nav="toggle-autoplay" ${sectionCount > 1 ? "" : "disabled"}>${this.autoplayActive ? "Stop autoplay" : "Autoplay"}</button>
            <button class="nav-btn accent" data-nav="next-section" aria-label="Next step" ${sectionCount && this.currentSectionIndex < sectionCount - 1 ? "" : "disabled"}>Next</button>
          </div>
        </div>
      `
      : `
        <div class="nav-row start-row">
          <div class="nav-label">${navLabel}</div>
          <div class="nav-actions">
            <button class="nav-btn ghost" data-nav="start-autoplay" aria-label="Autoplay proof" ${sectionCount > 1 ? "" : "disabled"}>Autoplay</button>
            <button class="nav-btn accent" data-nav="start-proof" aria-label="Start proof" ${hasSteps ? "" : "disabled"}>Spustit důkaz</button>
          </div>
        </div>
      `;

    const progressPrimary = sectionCount
      ? hasStarted
        ? `${this.currentSectionIndex + 1}/${sectionCount} steps`
        : `${sectionCount} krok${sectionCount === 1 ? "" : sectionCount >= 5 ? "ů" : "y"} připraveno`
      : "Waiting for steps";
    const progressSecondary = hasStarted ? `${this.progress}%` : "Ready";
    const transcriptClass = showStartScreen || proofSteps.length === 0 ? "transcript start" : "transcript";

    this.shadowRoot.innerHTML = `
      <style>
        /* STYLE LOADING STRATEGY:
           1. Preferred: Serve 'katex.min.css' locally and point the URL below to it.
           2. Fallback: Keep the CDN for CSS only (fonts are hard to bundle manually without a loader).
        */
        @import url("https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css"); /* Update this path to where your server hosts static assets */
        
        :host {
          display: block;
        }
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
        .progress-block {
          min-width: 240px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }
        .progress-track {
          width: 240px;
          height: 6px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.2);
          overflow: hidden;
          position: relative;
        }
        .progress-fill {
          position: absolute;
          inset: 0;
          width: ${this.progress}%;
          max-width: 100%;
          background: linear-gradient(90deg, var(--accent, #0ea5e9), var(--glow, #67e8f9));
          transition: width 140ms ease-out;
        }
        .progress-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #94a3b8;
          font-size: 12px;
        }
        .step-markers {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 16px 0 6px;
        }
        .marker {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(255, 255, 255, 0.02);
          color: #cbd5e1;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
        }
        .marker:hover {
          border-color: rgba(14, 165, 233, 0.6);
          background: rgba(14, 165, 233, 0.08);
          transform: translateY(-1px);
        }
        .marker.active {
          background: rgba(14, 165, 233, 0.16);
          border-color: rgba(14, 165, 233, 0.7);
          color: #e0f2fe;
          box-shadow: 0 12px 26px rgba(14, 165, 233, 0.25);
        }
        .grid {
          display: grid;
          gap: 22px;
          grid-template-columns: 1fr 1.15fr;
          align-items: flex-start;
        }
        .proof-pane {
          display: grid;
          gap: 14px;
        }
        .transcript {
          padding: 18px 14px;
          border-left: 3px solid rgba(14, 165, 233, 0.45);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0));
          border-radius: 0 12px 12px 0;
          min-height: 320px;
          max-height: 420px;
          overflow-y: auto;
          scroll-behavior: smooth;
          line-height: 1.8;
          color: #e2e8f0;
          font-size: 15px;
        }
        .transcript.start {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 18px 18px;
        }
        .flow-sentence {
          display: inline;
          color: #e2e8f0;
        }
        .flow-sentence:not(:last-child)::after {
          content: " ";
        }
        .flow-sentence.active {
          background: rgba(14, 165, 233, 0.1);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
          border-radius: 10px;
          padding: 2px 4px;
        }
        .start-card {
          display: grid;
          gap: 10px;
          width: 100%;
        }
        .start-title {
          margin: 0;
          color: #e2e8f0;
          font-size: clamp(20px, 3vw, 26px);
        }
        .theorem-statement {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(148, 163, 184, 0.2);
          line-height: 1.6;
        }
        .eyebrow {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }
        .start-note {
          margin: 0;
          color: #cbd5e1;
          line-height: 1.5;
        }
        .nav-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
        }
        .nav-row.start-row {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
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
        .nav-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
          flex-shrink: 0;
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
        .muted-label {
          margin: 0;
          color: #94a3b8;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
        .player-meta > div:first-child {
          min-width: 0;
        }
        .player-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
          font-size: 12px;
          font-weight: 700;
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
        .notice.warning {
          background: rgba(248, 113, 113, 0.12);
          border-color: rgba(248, 113, 113, 0.45);
          color: #fecdd3;
        }
        .step-markers.locked .marker {
          opacity: 0.55;
          pointer-events: none;
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .progress-block {
            width: 100%;
            align-items: flex-start;
          }
          .progress-track {
            width: 100%;
          }
          .progress-meta {
            justify-content: space-between;
            width: 100%;
          }
        }
      </style>
      <section class="shell" aria-label="Proof visualizer">
        <header class="top">
          <div>
            <h1>${title}</h1>
            <p class="lede">${description}</p>
          </div>
          <div class="progress-block" aria-label="Progress ${sectionCount ? `(step ${this.currentSectionIndex + 1} of ${sectionCount})` : ""}">
            <div class="progress-track">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-meta">
              <span>${progressPrimary}</span>
              <span>${progressSecondary}</span>
            </div>
          </div>
        </header>

        ${stepMarkers}

        <div class="grid">
          <article class="proof-pane" aria-live="polite">
            <div class="${transcriptClass}">
              ${transcript}
            </div>
            ${navRow}
            <button class="nav-btn" data-nav="back-menu">Menu důkazů</button>
          </article>

          <aside class="visual-pane" aria-live="polite">
            <div class="visual-head">
              <p class="muted-label">Scene</p>
              <div class="scene-title">${this.animation?.scene || "Visualization"}</div>
            </div>
            ${videoBody}
          </aside>
        </div>
      </section>
    `;

    this.bindEvents();
    this.bindVideoActions();
    this.queueAutoplayTick();
    this.scrollToActive();
  }

  scrollToActive() {
    // Smoothly scroll to the active revealed sentence so it stays in view
    if (!this.hasStarted) return;
    const active = this.shadowRoot.querySelector(".flow-sentence.active");
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll("[data-section-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.sectionIndex);
        this.stopAutoplay(false);
        this.setSection(index);
      });
    });

    const prev = this.shadowRoot.querySelector('[data-nav="prev-section"]');
    const next = this.shadowRoot.querySelector('[data-nav="next-section"]');
    const back = this.shadowRoot.querySelector('[data-nav="back-menu"]');
    const start = this.shadowRoot.querySelector('[data-nav="start-proof"]');
    const restart = this.shadowRoot.querySelector('[data-nav="restart-proof"]');
    const toggleAutoplay = this.shadowRoot.querySelector('[data-nav="toggle-autoplay"]');
    const startAutoplay = this.shadowRoot.querySelector('[data-nav="start-autoplay"]');

    if (prev) prev.addEventListener("click", () => {
      this.stopAutoplay(false);
      this.changeSection(-1);
    });
    if (next) next.addEventListener("click", () => {
      this.stopAutoplay(false);
      this.changeSection(1);
    });
    if (back) back.addEventListener("click", () => {
      this.stopAutoplay();
      this.dispatchEvent(new CustomEvent("back-to-menu", { bubbles: true, composed: true }));
    });
    if (start) start.addEventListener("click", () => {
      this.stopAutoplay(false);
      this.startProof(0);
    });
    if (startAutoplay) startAutoplay.addEventListener("click", () => this.startAutoplay());
    if (restart) restart.addEventListener("click", () => {
      this.stopAutoplay(false);
      this.hasStarted = false;
      this.currentSectionIndex = 0;
      this.render();
    });
    if (toggleAutoplay) toggleAutoplay.addEventListener("click", () => this.toggleAutoplay());
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

customElements.define("proof-viewer", ProofViewer);
