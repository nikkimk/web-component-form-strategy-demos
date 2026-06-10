import { LabellingController, LABELLING_DEBUG_HTML, applyLabellingDebug } from './labelling-controller.js';

class ProgressbarHybrid extends HTMLElement {
    #labelling   = new LabellingController({ onUpdate: () => this.#updateDebug() });
    #roleEl      = null;
    #fillEl      = null;
    #valueTextEl = null;
    #value       = 0;
    #max         = 100;
    #timer       = null;

    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    static get observedAttributes() { return ['labelledby', 'describedby', 'value', 'max']; }
    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'max')   { this.#max = Number(val ?? 100); }
        if (name === 'value') { clearInterval(this.#timer); this.#timer = null; this.#setValue(Number(val ?? 0)); }
    }

    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden><slot name="label"></slot></span>
                <div
                    id="role"
                    class="progressbar-surface"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="${this.#max}"
                    part="progressbar"
                >
                    <div class="progressbar-track" aria-hidden="true">
                        <div class="progressbar-fill" part="fill"></div>
                    </div>
                    <span class="progressbar-value" aria-hidden="true" part="value-text"></span>
                </div>
                <span id="description" class="field-help" hidden><slot name="description"></slot></span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">${LABELLING_DEBUG_HTML}</dl>
                </div>
            </div>
        `;
        this.#roleEl      = this.shadowRoot.querySelector('#role');
        this.#fillEl      = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueTextEl = this.shadowRoot.querySelector('.progressbar-value');
        this.#labelling.connect(this.shadowRoot);

        if (this.hasAttribute('value')) {
            this.#setValue(Number(this.getAttribute('value')));
        } else {
            this.#timer = setInterval(() => {
                this.#setValue(this.#value >= this.#max ? 0 : this.#value + 5);
            }, 800);
        }
    }

    disconnectedCallback() { clearInterval(this.#timer); }

    #setValue(val) {
        this.#value = Math.min(this.#max, Math.max(0, val));
        const pct = (this.#value / this.#max) * 100;
        this.#roleEl.setAttribute('aria-valuenow', String(this.#value));
        this.#roleEl.setAttribute('aria-valuetext', `${Math.round(pct)}% complete`);
        this.#fillEl.style.width = `${pct}%`;
        this.#valueTextEl.textContent = `${Math.round(pct)}%`;
    }

    #updateDebug() {
        applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo);
    }
}

customElements.define('progressbar-hybrid', ProgressbarHybrid);
