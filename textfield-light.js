const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}
class TextfieldLight extends HTMLElement {
    #inputEl     = null;
    #labelledby  = '';
    #describedby = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() { return ['labelledby', 'describedby']; }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
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
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <input id="input" type="text" class="textfield-input-native" part="input" />
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
        this.#inputEl = this.shadowRoot.querySelector('#input');
        this.#wireAria();
    }

    #wireAria() {
        if (!this.#inputEl) return;
        const labelEls = resolveIds(this.#labelledby);
        const descEls  = resolveIds(this.#describedby);

        if (SUPPORTS_ELEMENT_REFS) {
            this.#inputEl.ariaLabelledByElements  = labelEls;
            this.#inputEl.ariaDescribedByElements = descEls;
        } else {
            const labelText = labelEls.map(el => el.textContent.trim()).join(' ');
            const descText  = descEls.map(el => el.textContent.trim()).join(' ');
            labelText ? this.#inputEl.setAttribute('aria-label', labelText)
                      : this.#inputEl.removeAttribute('aria-label');
            descText  ? this.#inputEl.setAttribute('aria-description', descText)
                      : this.#inputEl.removeAttribute('aria-description');
        }
        this.#updateDebug(labelEls, descEls);
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

customElements.define('textfield-light', TextfieldLight);
