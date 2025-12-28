import "./proof-menu.js";
import "./proof-viewer.js";
import "./definition-viewer.js";

class MathVisualizerApp extends HTMLElement {
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
		this.activeStepIndex = null;
		this.onPopState = () => {
			this.updateStateFromLocation();
			this.render();
		};
	}

	connectedCallback() {
		this.initRouter();
		this.render();
		this.loadAnimations();
		this.loadDefinitions();
	}

	disconnectedCallback() {
		if (typeof window !== "undefined") {
			window.removeEventListener("popstate", this.onPopState);
		}
	}

	get activeAnimation() {
		return (
			this.animations.find((anim) => anim.id === this.activeAnimationId) || null
		);
	}

	get activeDefinition() {
		return (
			this.definitions.find((def) => def.id === this.activeDefinitionId) || null
		);
	}

	async loadAnimations() {
		this.animationsLoading = true;
		this.animationError = "";
		this.render();

		try {
			const response = await fetch("/proofs/manifest.json", {
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(
					"No proof manifest found. Run `npm run build:proofs` to generate videos.",
				);
			}
			const payload = await response.json();
			const items = Array.isArray(payload.items) ? payload.items : [];
			const normalized = this.normalizeAnimations(items);
			this.animations = normalized;
			if (!normalized.length) {
				this.animationError =
					"No videos in the manifest yet. Add Manim scenes in data/proofs and rebuild to render them.";
			}
		} catch (error) {
			this.animationError =
				error instanceof Error
					? error.message
					: "Unable to load Manim manifest.";
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
			const response = await fetch("/definitions/manifest.json", {
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(
					"No definitions found. Add definitions to data/definitions and rebuild.",
				);
			}
			const payload = await response.json();
			const items = Array.isArray(payload.items) ? payload.items : [];
			this.definitions = items;
			if (!items.length) {
				this.definitionsError =
					"Definitions file is empty. Add items to data/definitions and rebuild.";
			}
		} catch (error) {
			this.definitionsError =
				error instanceof Error ? error.message : "Unable to load definitions.";
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

	initRouter() {
		if (typeof window === "undefined") return;
		window.addEventListener("popstate", this.onPopState);
		this.updateStateFromLocation();
	}

	updateStateFromLocation() {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		const proofId = url.searchParams.get("proof");
		const definitionId = url.searchParams.get("definition");
		const stepParam = url.searchParams.get("step");
		const parsedStep = Number.parseInt(stepParam ?? "", 10);
		const stepIndex =
			Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep - 1 : null;

		if (proofId) {
			this.activeAnimationId = proofId;
			this.activeDefinitionId = null;
			this.showMenu = false;
			this.activeStepIndex = stepIndex;
		} else if (definitionId) {
			this.activeDefinitionId = definitionId;
			this.activeAnimationId = null;
			this.showMenu = false;
			this.activeStepIndex = null;
		} else {
			this.activeAnimationId = null;
			this.activeDefinitionId = null;
			this.showMenu = true;
			this.activeStepIndex = null;
		}
	}

	updateRoute(
		{ proofId = null, definitionId = null, stepIndex = null } = {},
		options = {},
	) {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		url.searchParams.delete("proof");
		url.searchParams.delete("definition");
		url.searchParams.delete("step");
		if (proofId) {
			url.searchParams.set("proof", proofId);
			if (typeof stepIndex === "number" && stepIndex >= 0) {
				url.searchParams.set("step", String(stepIndex + 1));
			}
		} else if (definitionId) {
			url.searchParams.set("definition", definitionId);
		}
		const method = options.replace ? "replaceState" : "pushState";
		window.history[method]({}, "", url);
	}

	handleSelectProof(id) {
		this.activeAnimationId = id;
		this.activeDefinitionId = null;
		this.showMenu = false;
		this.activeStepIndex = null;
		this.updateRoute({ proofId: id });
		this.render();
	}

	handleSelectDefinition(id) {
		this.activeDefinitionId = id;
		this.activeAnimationId = null;
		this.showMenu = false;
		this.activeStepIndex = null;
		this.updateRoute({ definitionId: id });
		this.render();
	}

	handleBackToMenu() {
		this.showMenu = true;
		this.activeAnimationId = null;
		this.activeDefinitionId = null;
		this.activeStepIndex = null;
		this.updateRoute({});
		this.render();
	}

	render() {
		const menuView =
			this.showMenu || (!this.activeAnimation && !this.activeDefinition);
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
          <h1>Knihovna vět</h1>
          <p class="lede">
            Vyber si větu/teorém ke zhlédnutí. Každá položka má formální část (v JSONu) a odpovídající Manim animace.
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
			viewerEl.requestedStepIndex = this.activeStepIndex;
			viewerEl.addEventListener("step-change", (event) => {
				const { stepIndex } = event.detail || {};
				this.activeStepIndex = typeof stepIndex === "number" ? stepIndex : null;
				this.updateRoute({
					proofId: this.activeAnimationId,
					stepIndex: this.activeStepIndex,
				});
			});
			viewerEl.addEventListener("claim-change", (event) => {
				const { animationId } = event.detail || {};
				if (!animationId) return;
				const target = this.animations.find((anim) => anim.id === animationId);
				if (!target) return;
				this.activeAnimationId = animationId;
				this.activeStepIndex = null;
				this.updateRoute({ proofId: animationId, stepIndex: null });
				this.render();
			});
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

customElements.define("math-visualizer-app", MathVisualizerApp);
