const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}
class TextfieldHybrid extends HTMLElement {
    #roleEl      = null;
    #labelEl     = null;
    #descEl      = null;
    #labelledby  = '';
    #describedby = '';

    constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }); }

    static get observedAttributes() { return ['labelledby', 'describedby']; }
    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
    }

    get labelledby()  { return this.#labelledby; }
    get describedby() { return this.#describedby; }
    set labelledby(val)  { this.#labelledby  = val ?? ''; this.#wireAria(); }
    set describedby(val) { this.#describedby = val ?? ''; this.#wireAria(); }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden><slot name="label"></slot></span>
                <input id="role" type="text" class="textfield-input-native" part="input" />
                <span id="description" class="field-help" hidden><slot name="description"></slot></span>
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
        this.#roleEl  = this.shadowRoot.querySelector('#role');
        this.#labelEl = this.shadowRoot.querySelector('#label');
        this.#descEl  = this.shadowRoot.querySelector('#description');
        this.shadowRoot.querySelectorAll('slot').forEach(s =>
            s.addEventListener('slotchange', () => this.#wireAria())
        );
        this.#wireAria();
    }

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
            if (hasLabel) { this.#roleEl.setAttribute('aria-labelledby', 'label'); }
            else {
                const t = resolveIds(this.#labelledby).map(e => e.textContent.trim()).join(' ');
                t ? this.#roleEl.setAttribute('aria-label', t) : this.#roleEl.removeAttribute('aria-label');
                this.#roleEl.removeAttribute('aria-labelledby');
            }
            if (hasDesc) { this.#roleEl.setAttribute('aria-describedby', 'description'); }
            else {
                const t = resolveIds(this.#describedby).map(e => e.textContent.trim()).join(' ');
                t ? this.#roleEl.setAttribute('aria-description', t) : this.#roleEl.removeAttribute('aria-description');
                this.#roleEl.removeAttribute('aria-describedby');
            }
        }
        this.#updateDebug(hasLabel, hasDesc);
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
customElements.define('textfield-hybrid', TextfieldHybrid);
