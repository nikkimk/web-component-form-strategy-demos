const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}
class ProgressbarLight extends HTMLElement {
    #pbEl        = null;
    #fillEl      = null;
    #valueTextEl = null;
    #labelledby  = '';
    #describedby = '';
    #value       = 0;
    #max         = 100;
    #timer       = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() { return ['labelledby', 'describedby', 'value', 'max']; }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'max')   { this.#max = Number(val ?? 100); }
        if (name === 'value') { this.#stopAnimation(); this.#setValue(Number(val ?? 0)); }
    }

    get labelledby()  { return this.#labelledby; }
    get describedby() { return this.#describedby; }

    set labelledby(val) {
        this.#labelledby = val ?? '';
        this.#wireAria();
    }

    set describedby(val) {
        this.#describedby = val ?? '';
        this.#wireAria();
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <div
                    id="progressbar"
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
                        <dt>labelledby</dt><dd id="db-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>describedby</dt><dd id="db-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                        <dt>Association API</dt><dd id="db-api"></dd>
                    </dl>
                </div>
            </div>
        `;

        this.#pbEl        = this.shadowRoot.querySelector('#progressbar');
        this.#fillEl      = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueTextEl = this.shadowRoot.querySelector('.progressbar-value');

        this.#wireAria();

        if (this.hasAttribute('value')) {
            this.#setValue(Number(this.getAttribute('value')));
        } else {
            this.#startAnimation();
        }
    }

    disconnectedCallback() { this.#stopAnimation(); }

    #wireAria() {
        if (!this.#pbEl) return;
        const labelEls = resolveIds(this.#labelledby);
        const descEls  = resolveIds(this.#describedby);

        if (SUPPORTS_ELEMENT_REFS) {
            this.#pbEl.ariaLabelledByElements  = labelEls;
            this.#pbEl.ariaDescribedByElements = descEls;
        } else {
            const labelText = labelEls.map(el => el.textContent.trim()).join(' ');
            const descText  = descEls.map(el => el.textContent.trim()).join(' ');
            labelText ? this.#pbEl.setAttribute('aria-label', labelText)
                      : this.#pbEl.removeAttribute('aria-label');
            descText  ? this.#pbEl.setAttribute('aria-description', descText)
                      : this.#pbEl.removeAttribute('aria-description');
        }
        this.#updateDebug(labelEls, descEls);
    }

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

    #updateDebug(labelEls, descEls) {
        const set = (sel, val) => { const el = this.shadowRoot.querySelector(sel); if (el) el.textContent = val; };
        set('#db-labelledby',  this.#labelledby);
        set('#db-label-text',  labelEls.map(e => e.textContent.trim()).join(', '));
        set('#db-describedby', this.#describedby);
        set('#db-desc-text',   descEls.map(e => e.textContent.trim()).join(', '));
        set('#db-api', SUPPORTS_ELEMENT_REFS
            ? 'ariaLabelledByElements / ariaDescribedByElements'
            : 'aria-label / aria-description (fallback)');
    }
}

customElements.define('progressbar-light', ProgressbarLight);
