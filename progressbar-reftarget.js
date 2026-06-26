class ProgressbarReftarget extends HTMLElement {
    #roleEl      = null;
    #fillEl      = null;
    #valueTextEl = null;
    #value       = 0;
    #max         = 100;
    #timer       = null;

    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    static get observedAttributes() { return ['value', 'max']; }
    attributeChangedCallback(name, _, val) {
        if (name === 'max')   { this.#max = Number(val ?? 100); }
        if (name === 'value') { clearInterval(this.#timer); this.#timer = null; this.#setValue(Number(val ?? 0)); }
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
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
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>shadowRoot.referenceTarget</dt><dd id="db-rt"></dd>
                        <dt>aria-labelledby (host)</dt><dd id="db-lb"></dd>
                        <dt>aria-describedby (host)</dt><dd id="db-db"></dd>
                        <dt>aria-valuenow</dt><dd id="db-val"></dd>
                    </dl>
                </div>
            </div>
        `;
        this.shadowRoot.referenceTarget = 'role';
        this.#roleEl      = this.shadowRoot.querySelector('#role');
        this.#fillEl      = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueTextEl = this.shadowRoot.querySelector('.progressbar-value');

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
        if (this.#roleEl) {
            this.#roleEl.setAttribute('aria-valuenow', String(this.#value));
            this.#roleEl.setAttribute('aria-valuetext', `${Math.round(pct)}% complete`);
        }
        if (this.#fillEl)      this.#fillEl.style.width = `${pct}%`;
        if (this.#valueTextEl) this.#valueTextEl.textContent = `${Math.round(pct)}%`;
        this.#updateDebug();
    }

    #updateDebug() {
        const set = (sel, val) => { const el = this.shadowRoot?.querySelector(sel); if (el) el.textContent = val ?? '(none)'; };
        set('#db-rt',  this.shadowRoot.referenceTarget ?? '(not set)');
        set('#db-lb',  this.getAttribute('aria-labelledby') ?? '(none)');
        set('#db-db',  this.getAttribute('aria-describedby') ?? '(none)');
        set('#db-val', this.#roleEl?.getAttribute('aria-valuenow') ?? '(none)');
    }
}
customElements.define('progressbar-reftarget', ProgressbarReftarget);
