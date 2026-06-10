class ProgressbarShadow extends HTMLElement {
    #pbEl        = null;
    #fillEl      = null;
    #valueTextEl = null;
    #labelEl     = null;
    #descEl      = null;
    #value       = 0;
    #max         = 100;
    #timer       = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() { return ['value', 'max']; }

    attributeChangedCallback(name, _, newVal) {
        if (name === 'max')   { this.#max = Number(newVal ?? 100); }
        if (name === 'value') { this.#stopAnimation(); this.#setValue(Number(newVal ?? 0)); }
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label">
                    <slot name="label">Progress</slot>
                </span>
                <div
                    id="progressbar"
                    class="progressbar-surface"
                    role="progressbar"
                    aria-labelledby="label"
                    aria-describedby="description"
                    aria-valuemin="0"
                    aria-valuemax="${this.#max}"
                    part="progressbar"
                >
                    <div class="progressbar-track" aria-hidden="true">
                        <div class="progressbar-fill" part="fill"></div>
                    </div>
                    <span class="progressbar-value" aria-hidden="true" part="value-text"></span>
                </div>
                <span id="description" class="field-help">
                    <slot name="description">Description</slot>
                </span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>aria-labelledby</dt><dd id="db-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>aria-describedby</dt><dd id="db-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                    </dl>
                </div>
            </div>
        `;

        this.#pbEl        = this.shadowRoot.querySelector('#progressbar');
        this.#fillEl      = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueTextEl = this.shadowRoot.querySelector('.progressbar-value');
        this.#labelEl     = this.shadowRoot.querySelector('#label');
        this.#descEl      = this.shadowRoot.querySelector('#description');

        this.shadowRoot.querySelectorAll('slot').forEach(s =>
            s.addEventListener('slotchange', () => this.#updateDebug())
        );

        if (this.hasAttribute('value')) {
            this.#setValue(Number(this.getAttribute('value')));
        } else {
            this.#startAnimation();
        }
        this.#updateDebug();
    }

    disconnectedCallback() { this.#stopAnimation(); }

    #setValue(val) {
        this.#value = Math.min(this.#max, Math.max(0, val));
        const pct = (this.#value / this.#max) * 100;
        this.#pbEl.setAttribute('aria-valuenow', String(this.#value));
        this.#pbEl.setAttribute('aria-valuetext', `${Math.round(pct)}% complete`);
        this.#fillEl.style.width = `${pct}%`;
        this.#valueTextEl.textContent = `${Math.round(pct)}%`;
    }

    #startAnimation() {
        this.#timer = setInterval(() => {
            this.#setValue(this.#value >= this.#max ? 0 : this.#value + 5);
        }, 800);
    }

    #stopAnimation() {
        if (this.#timer !== null) { clearInterval(this.#timer); this.#timer = null; }
    }

    #updateDebug() {
        const set = (sel, val) => {
            const el = this.shadowRoot.querySelector(sel);
            if (el) el.textContent = val;
        };
        set('#db-labelledby',  this.#pbEl?.getAttribute('aria-labelledby') ?? '');
        set('#db-label-text',  this.#labelEl?.textContent.trim() ?? '');
        set('#db-describedby', this.#pbEl?.getAttribute('aria-describedby') ?? '');
        set('#db-desc-text',   this.#descEl?.textContent.trim() ?? '');
    }
}

customElements.define('progressbar-shadow', ProgressbarShadow);
