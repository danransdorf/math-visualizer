import katex from "katex";
import { renderRichText } from "../utils/rich-text.js";
import { tagList } from "../utils/tags.js";

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
    this.pendingStepIndex = null;
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

  set requestedStepIndex(value) {
    if (value === null || value === undefined) {
      this.pendingStepIndex = null;
      return;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      this.pendingStepIndex = parsed;
      this.applyRequestedStep();
    }
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

  emitStepChange(stepIndex = this.currentSectionIndex) {
    this.dispatchEvent(
      new CustomEvent("step-change", {
        detail: {
          stepIndex: typeof stepIndex === "number" && Number.isFinite(stepIndex) ? stepIndex : null,
          stepNumber: typeof stepIndex === "number" && Number.isFinite(stepIndex) ? stepIndex + 1 : null,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  setSection(index, options = {}) {
    const { silent = false } = options;
    const clampedIndex = this.clampIndex(index);
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.currentSectionIndex = clampedIndex;
      this.render();
      if (!silent) this.emitStepChange(clampedIndex);
      return;
    }
    if (clampedIndex === this.currentSectionIndex) return;
    this.currentSectionIndex = clampedIndex;
    this.render();
    if (!silent) this.emitStepChange(clampedIndex);
  }

  changeSection(delta) {
    this.setSection(this.currentSectionIndex + delta);
  }

  startProof(index = 0, options = {}) {
    this.setSection(index, options);
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
   * Uses shared renderer for KaTeX + basic Markdown.
   */
  parseContent(text) {
    return renderRichText(text);
  }

  filterCurrentOnly(text, isActive) {
    if (typeof text !== "string") return text;
    return text.replace(/\[\[current-only\]\]([\s\S]*?)\[\[\/current-only\]\]/gi, (_, inner) =>
      isActive ? inner : "",
    );
  }

  get claims() {
    const claims = this.animation?.proof?.claims;
    return Array.isArray(claims) ? claims : [];
  }

  get activeClaimId() {
    const claims = this.claims;
    if (!claims.length) return null;
    const requested = this.animation?.proof?.activeClaimId;
    const found = claims.find((claim) => claim?.id === requested);
    if (found) return found.id;
    return claims[0]?.id || null;
  }

  get activeClaim() {
    const activeId = this.activeClaimId;
    if (!activeId) return null;
    return this.claims.find((claim) => claim?.id === activeId) || null;
  }

  renderClaimTabs() {
    const claims = this.claims;
    if (!claims.length) return "";
    const activeId = this.activeClaimId;
    if (claims.length === 1 && (!claims[0].label || claims[0].label === "main")) return "";

    const buttons = claims
      .map((claim) => {
        const isActive = claim?.id === activeId;
        const target = claim?.animationId || "";
        const label = claim?.label || claim?.id || "";
        return `
          <button
            class="claim-chip ${isActive ? "active" : ""}"
            data-claim-id="${claim?.id ?? ""}"
            ${target ? `data-claim-target="${target}"` : ""}
            role="tab"
            aria-selected="${isActive ? "true" : "false"}"
          >
            ${this.parseContent(label)}
          </button>
        `;
      })
      .join("");

    return `<div class="claim-tabs" role="tablist" aria-label="Proof variants">${buttons}</div>`;
  }

  renderTranscript(proofSteps) {
    const limit = Math.min(this.currentSectionIndex + 1, proofSteps.length);
    const stepsToRender = proofSteps.slice(0, limit);
    if (!stepsToRender.length) return "";

    const combined = stepsToRender
      .map((proofStep, idx) => {
        const isActive = idx === this.currentSectionIndex;
        const rawStatement = proofStep?.statement || "This section is pending a description.";
        const filtered = this.filterCurrentOnly(rawStatement, isActive);
        return typeof filtered === "string" ? filtered.trim() : "";
      })
      .filter(Boolean)
      .join(" ");

    if (!combined) return "";
    const html = this.parseContent(combined);
    return `<span class="flow-sentence">${html}</span>`;
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

  loadGlobalStyles() {
    return new Promise((resolve, reject) => {
      // Use the version matching your installed package, or fallback to latest
      const version = (typeof katex !== "undefined" && katex.version) ? katex.version : "0.16.10";
      const url = `https://cdn.jsdelivr.net/npm/katex@${version}/dist/katex.min.css`;
      
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
    const title = this.animation?.proof?.title || this.animation?.scene || "Theorem";
    const description =
      this.animation?.proof?.description ||
      this.animation?.source ||
      "This theorem has no descripiton yet.";
    const numberTag = this.getNumberTag(this.animation, this.animation?.proof);
    const numberLabel = numberTag ? `<span class="number-label">${this.parseContent(numberTag.value)}</span>` : "";
    const tagRow = this.renderTagRow(this.animation, this.animation?.proof, { excludeKinds: ["number"] });
    const theoremHtml = this.parseContent(
      this.theoremStatement || "Tato věta zatím nemá formulovaný výrok.",
    );
    const claim = this.activeClaim;
    const claimLabel = claim?.label || claim?.id || "";
    const claimStatement = claim?.statement ? this.parseContent(claim.statement) : null;
    const claimTabs = this.renderClaimTabs();
    const claimTabsBlock = claimTabs
      ? `
        <div class="claim-tabs-wrapper">
          <span class="claim-tabs-label">Vyber část důkazu:</span>
          ${claimTabs}
        </div>
      `
      : "";
    const startNote = proofSteps.length > 0
      ? "Vyber část věty a spusť přehrávání kroku po kroku."
      : "Přidej formální kroky do .proof.json, aby bylo co přehrát.";

    const transcript =
      hasStarted && proofSteps.length > 0
        ? this.renderTranscript(proofSteps)
        : `
          <div class="start-card">
            <p class="eyebrow">Dokazované tvrzení</p>
            <h2 class="start-title">
              ${title}
              ${
                claimLabel
                  ? `<span class="claim-heading">${this.parseContent(claimLabel)}</span>`
                  : ""
              }
            </h2>
            <div class="theorem-statement">
              ${claimStatement || theoremHtml}
            </div>
            <p class="start-note">${startNote}</p>
          </div>
        `;
    const rawJustification = proofSteps[this.currentSectionIndex]?.justification || activeSection?.description || "";
    const currentJustification = this.filterCurrentOnly(rawJustification, true);
    const navSnippet = hasStarted ? currentJustification : null;
    const navLabel = hasStarted
      ? `
        <span class="nav-explain" aria-label="Vysvětlení kroku">
          Vysvětlení
          <span class="hover-card">${this.parseContent(navSnippet || "Tento krok zatím nemá vysvětlení.")}</span>
        </span>
        <span class="nav-count">${`${this.currentSectionIndex + 1}/${sectionCount || 1}`}</span>
      `
      : "";

    const progressPrimary = sectionCount
      ? hasStarted
        ? `${this.currentSectionIndex + 1}/${sectionCount} steps`
        : `${sectionCount} krok${sectionCount === 1 ? "" : sectionCount >= 5 ? "ů" : "y"} připraveno`
      : "Waiting for steps";
    const progressSecondary = hasStarted ? `${this.progress}%` : "Ready";
    const progressBlock = `
      <div class="progress-block" aria-label="Progress ${sectionCount ? `(step ${this.currentSectionIndex + 1} of ${sectionCount})` : ""}">
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-meta">
          <span>${progressPrimary}</span>
          <span>${progressSecondary}</span>
        </div>
      </div>
    `;

    const videoBody =
      activeSection && activeSection.url
        ? `
            <div class="player">
              <div class="video-frame">
                <video key="${activeSection.id}" preload="metadata" src="${activeSection.url}" aria-label="Manim section" muted autoplay playsinline></video>
              </div>
              <div class="player-meta">
                <div class="player-actions">
                  <button class="nav-btn ghost" data-video-action="replay">Replay</button>
                </div>
              </div>
            </div>
          `
        : `<p class="notice">No section video available. Add \`next_section()\` calls and rerun \`npm run build:proofs\`.</p>`;
    const navButtons = hasStarted && hasSteps
      ? `
        <div class="nav-buttons">
          <button class="nav-btn subtle" data-nav="prev-section" aria-label="Previous step" ${this.currentSectionIndex === 0 ? "disabled" : ""}>Previous</button>
          <button class="nav-btn ghost" data-nav="restart-proof">Restart</button>
          <button class="nav-btn ghost" data-nav="toggle-autoplay" ${sectionCount > 1 ? "" : "disabled"}>${this.autoplayActive ? "Stop autoplay" : "Autoplay"}</button>
          <button class="nav-btn accent" data-nav="next-section" aria-label="Next step" ${sectionCount && this.currentSectionIndex < sectionCount - 1 ? "" : "disabled"}>Next</button>
        </div>
      `
      : `
        <div class="nav-buttons">
          <button class="nav-btn ghost" data-nav="start-autoplay" aria-label="Autoplay proof" ${sectionCount > 1 ? "" : "disabled"}>Autoplay</button>
          <button class="nav-btn ghost" data-nav="start-proof" aria-label="Start theorem playback" ${hasSteps ? "" : "disabled"}>Spustit přehrávání</button>
        </div>
      `;

    const navRow = `
      <div class="nav-row ${hasStarted && hasSteps ? "" : "start"}">
        ${navButtons}
      </div>
    `;
    const explanationBlock = navLabel ? `<div class="nav-label explanation">${navLabel}</div>` : "";
    const controlsRow = `
      <div class="controls-row">
        <div class="controls-left">${navRow}</div>
        <div class="controls-right">${progressBlock}</div>
      </div>
    `;

    const transcriptClass = showStartScreen || proofSteps.length === 0 ? "transcript start" : "transcript";

    this.shadowRoot.innerHTML = `
      <style>
        /* STYLE LOADING STRATEGY:
           1. Preferred: Serve 'katex.min.css' locally and point the URL below to it.
           2. Fallback: Keep the CDN for CSS only (fonts are hard to bundle manually without a loader).
        */
        @import url("https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css"); /* Update this path to where your server hosts static assets */
        
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
        .number-label {
          margin: 0 0 2px;
          color: #94a3b8;
          font-size: 12px;
          letter-spacing: 0.04em;
          display: inline-flex;
        }
        .lede {
          margin: 0;
          color: var(--text-regular, #c3cfe0);
          max-width: 720px;
          line-height: 1.6;
        }
        .tag-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 6px 0 8px;
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
        .top-actions {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .claim-tabs {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 6px 0 8px;
          align-items: center;
        }
        .claim-tabs-wrapper {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin: 10px 0 12px;
        }
        .claim-tabs-label {
          color: #94a3b8;
          font-size: 13px;
          margin-right: 4px;
        }
        .claim-chip {
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
        }
        .claim-chip.active {
          background: rgba(14, 165, 233, 0.16);
          border-color: rgba(14, 165, 233, 0.6);
          color: #e0f2fe;
          box-shadow: 0 8px 18px rgba(14, 165, 233, 0.25);
        }
        .claim-chip.inline {
          padding: 4px 8px;
          font-size: 12px;
        }
        .claim-chip:hover {
          transform: translateY(-1px);
          border-color: rgba(14, 165, 233, 0.6);
        }
        .statements {
          display: grid;
          gap: 10px;
          margin: 10px 0 6px;
        }
        .statement-block {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .statement-block .statement-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .statement-block .statement-body {
          color: var(--text-regular, #c3cfe0);
          line-height: 1.6;
        }
        .progress-block {
          min-width: 220px;
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
          color: var(--text-regular, #c3cfe0);
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
          color: var(--text-regular, #c3cfe0);
        }
        .flow-sentence:not(:last-child)::after {
          content: " ";
        }
        .start-card {
          display: grid;
          gap: 10px;
          width: 100%;
        }
        .start-title {
          margin: 0;
          color: #e2e8f0;
          font-size: clamp(18px, 2.8vw, 24px);
          display: inline-flex;
          gap: 6px;
          align-items: baseline;
        }
        .theorem-statement {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(148, 163, 184, 0.2);
          line-height: 1.6;
          color: var(--text-regular, #c3cfe0);
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
          color: var(--text-regular, #c3cfe0);
          line-height: 1.5;
        }
        .claim-heading {
          color: #94a3b8;
          font-size: 0.95em;
          font-weight: 600;
        }
        .nav-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .nav-row.start {
          justify-content: space-between;
        }
        .nav-label {
          color: var(--text-regular, #c3cfe0);
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(148, 163, 184, 0.08);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          max-width: 100%;
          white-space: nowrap;
          overflow: visible;
          line-height: 1.4;
        }
        .nav-label.explanation {
          margin-top: 4px;
        }
        .nav-explain {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #e2e8f0;
          font-weight: 600;
          cursor: default;
        }
        .nav-explain::before {
          content: "ℹ";
          font-size: 12px;
          color: #38bdf8;
        }
        .hover-card {
          position: absolute;
          bottom: 120%;
          left: 0;
          z-index: 2;
          min-width: 220px;
          max-width: min(480px, 70vw);
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #c3cfe0;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
          transform-origin: bottom left;
          opacity: 0;
          pointer-events: none;
          transition: opacity 100ms ease, transform 100ms ease;
          line-height: 1.5;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .nav-explain:hover .hover-card,
        .nav-explain:focus-within .hover-card {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(-2px);
        }
        .nav-count {
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        strong { color: var(--text-strong, #e2e8f0); }
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
        .nav-buttons {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .controls-row {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 22px;
          align-items: start;
          margin-top: 8px;
        }
        .controls-left {
          display: grid;
        }
        .controls-right {
          display: flex;
          justify-content: flex-end;
        }
        .visual-pane {
          display: grid;
          gap: 12px;
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
      <section class="shell" aria-label="Theorem viewer">
        <header class="top">
          <div>
            ${numberLabel}
            <h1>${title}</h1>
            ${tagRow}
            <p class="lede">${this.parseContent(description)}</p>
          </div>
          <div class="top-actions">
            <button class="nav-btn ghost" data-nav="back-menu">Zpět do menu</button>
          </div>
        </header>

        <div class="statements">
          <div class="statement-block theorem">
            <div class="statement-head">
              <span class="eyebrow">Celé znění věty</span>
              ${numberLabel}
            </div>
            <div class="statement-body">${theoremHtml}</div>
          </div>
        </div>
        ${claimTabsBlock}

        ${controlsRow}

        <div class="grid">
          <article class="proof-pane" aria-live="polite">
            <div class="${transcriptClass}">
              ${transcript}
            </div>
            ${explanationBlock}
          </article>

          <aside class="visual-pane" aria-live="polite">
            ${videoBody}
          </aside>
        </div>
      </section>
    `;

    this.bindEvents();
    this.bindClaimTabs();
    this.bindVideoActions();
    this.queueAutoplayTick();
    this.scrollToActive();
    this.applyRequestedStep();
  }

  applyRequestedStep() {
    if (this.pendingStepIndex === null || this.pendingStepIndex === undefined) return;
    if (this.stepCount <= 0) return;
    const targetIndex = this.clampIndex(this.pendingStepIndex);
    this.pendingStepIndex = null;
    this.setSection(targetIndex, { silent: true });
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
    const prev = this.shadowRoot.querySelector('[data-nav="prev-section"]');
    const next = this.shadowRoot.querySelector('[data-nav="next-section"]');
    const back = this.shadowRoot.querySelector('[data-nav="back-menu"]');
    const start = this.shadowRoot.querySelector('[data-nav="start-proof"]');
    const startAutoplay = this.shadowRoot.querySelector('[data-nav="start-autoplay"]');
    const restart = this.shadowRoot.querySelector('[data-nav="restart-proof"]');
    const toggleAutoplay = this.shadowRoot.querySelector('[data-nav="toggle-autoplay"]');

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
      this.emitStepChange(null);
    });
    if (toggleAutoplay) toggleAutoplay.addEventListener("click", () => this.toggleAutoplay());
  }

  bindClaimTabs() {
    this.shadowRoot.querySelectorAll("[data-claim-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetAnim = button.getAttribute("data-claim-target");
        const claimId = button.getAttribute("data-claim-id");
        if (targetAnim && targetAnim !== this.animation?.id) {
          this.dispatchEvent(
            new CustomEvent("claim-change", {
              detail: { animationId: targetAnim, claimId },
              bubbles: true,
              composed: true,
            }),
          );
          return;
        }
      });
    });
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
