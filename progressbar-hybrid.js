const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}
class ProgressbarHybrid extends HTMLElement {
    #roleEl      = null;
    #labelEl     = null;
    #descEl      = null;
    #labelledby  = '';
    #describedby = '';
    #fillEl      = null;
    #valueTextEl = null;
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
        if (name === 'value') {
            clearInterval(this.#timer); this.#timer = null;
            this.#setValue(Number(val ?? 0));
        }
    }

    get labelledby()  { return this.#labelledby; }
    get describedby() { return this.#describedby; }
    set labelledby(val)  { this.#labelledby  = val ?? ''; this.#wireAria(); }
    set describedby(val) { this.#describedby = val ?? ''; this.#wireAria(); }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden>
                    <slot name="label"></slot>
                </span>
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
                <span id="description" class="field-help" hidden>
                    <slot name="description"></slot>
                </span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>Mode</dt><dd id="db-mode"></dd>
                        <dt>labelledby prop</dt><dd id="db-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>describedby prop</dt><dd id="db-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                        <dt>Association API</dt><dd id="db-api"></dd>
                    </dl>
                </div>
            </div>
        `;
        this.#roleEl      = this.shadowRoot.querySelector('#role');
        this.#labelEl     = this.shadowRoot.querySelector('#label');
        this.#descEl      = this.shadowRoot.querySelector('#description');
        this.#fillEl      = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueTextEl = this.shadowRoot.querySelector('.progressbar-value');

        this.shadowRoot.querySelectorAll('slot').forEach(s =>
            s.addEventListener('slotchange', () => this.#wireAria())
        );
        this.#wireAria();

        if (this.hasAttribute('value')) {
            this.#setValue(Number(this.getAttribute('value')));
        } else {
            this.#timer = setInterval(() => {
                this.#setValue(this.#value >= this.#max ? 0 : this.#value + 5);
            }, 800);
        }
    }

    disconnectedCallback() { clearInterval(this.#timer); }

    #slotHasContent(name) {
        const slot = this.shadowRoot.querySelector(`slot[name="${name}"]`);
        return !!slot?.assignedNodes({ flatten: true }).some(n => n.textContent.trim());
    }

    #wireAria() {
        if (!this.#roleEl) return;
        const hasLabel = this.#slotHasContent('label');
        const hasDesc  = this.#slotHasContent('description');
        this.#labelEl.hidden = !hasLabel;
        this.#descEl.hidden  = !hasDesc;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#roleEl.ariaLabelledByElements  = hasLabel ? [this.#labelEl] : resolveIds(this.#labelledby);
            this.#roleEl.ariaDescribedByElements = hasDesc  ? [this.#descEl]  : resolveIds(this.#describedby);
        } else {
            if (hasLabel) {
                this.#roleEl.setAttribute('aria-labelledby', 'label');
            } else {
                const text = resolveIds(this.#labelledby).map(e => e.textContent.trim()).join(' ');
                text ? this.#roleEl.setAttribute('aria-label', text) : this.#roleEl.removeAttribute('aria-label');
                this.#roleEl.removeAttribute('aria-labelledby');
            }
            if (hasDesc) {
                this.#roleEl.setAttribute('aria-describedby', 'description');
            } else {
                const text = resolveIds(this.#describedby).map(e => e.textContent.trim()).join(' ');
                text ? this.#roleEl.setAttribute('aria-description', text) : this.#roleEl.removeAttribute('aria-description');
                this.#roleEl.removeAttribute('aria-describedby');
            }
        }
        this.#updateDebug(hasLabel, hasDesc);
    }

    #setValue(val) {
        this.#value = Math.min(this.#max, Math.max(0, val));
        const pct = (this.#value / this.#max) * 100;
        this.#roleEl.setAttribute('aria-valuenow', String(this.#value));
        this.#roleEl.setAttribute('aria-valuetext', `${Math.round(pct)}% complete`);
        this.#fillEl.style.width = `${pct}%`;
        this.#valueTextEl.textContent = `${Math.round(pct)}%`;
    }

    #updateDebug(hasLabel, hasDesc) {
        const set = (sel, val) => { const el = this.shadowRoot.querySelector(sel); if (el) el.textContent = val; };
        const labelEls = hasLabel ? [this.#labelEl] : resolveIds(this.#labelledby);
        const descEls  = hasDesc  ? [this.#descEl]  : resolveIds(this.#describedby);
        set('#db-mode',        hasLabel || hasDesc ? 'slotted' : 'light DOM siblings');
        set('#db-labelledby',  this.#labelledby  || '(not set)');
        set('#db-label-text',  labelEls.map(e => e.textContent.trim()).join(', '));
        set('#db-describedby', this.#describedby || '(not set)');
        set('#db-desc-text',   descEls.map(e => e.textContent.trim()).join(', '));
        set('#db-api', SUPPORTS_ELEMENT_REFS
            ? (hasLabel || hasDesc ? 'ariaLabelledByElements \u2192 shadow span' : 'ariaLabelledByElements \u2192 light sibling')
            : (hasLabel || hasDesc ? 'aria-labelledby (same-root)' : 'aria-label / aria-description (fallback)'));
    }
}

customElements.define('progressbar-hybrid', ProgressbarHybrid);
