const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;
class CheckboxLight extends HTMLElement {
    #inputEl = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() { return ['aria-labelledby', 'aria-describedby']; }
    attributeChangedCallback() { this.#wireAria(); }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <div class="checkbox-native-surface">
                    <input id="input" type="checkbox" class="checkbox-input-native" part="input" />
                </div>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>Host aria-labelledby</dt><dd id="db-host-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>Host aria-describedby</dt><dd id="db-host-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                        <dt>Association API</dt><dd id="db-api"></dd>
                    </dl>
                </div>
            </div>
        `;
        this.#inputEl = this.shadowRoot.querySelector('#input');
        this.#wireAria();
    }

    #resolveIds(attr) {
        return (this.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)
            .map(id => document.getElementById(id)).filter(Boolean);
    }

    #wireAria() {
        if (!this.#inputEl) return;
        const labelEls = this.#resolveIds('aria-labelledby');
        const descEls  = this.#resolveIds('aria-describedby');

        if (SUPPORTS_ELEMENT_REFS) {
            this.#inputEl.ariaLabelledByElements  = labelEls;
            this.#inputEl.ariaDescribedByElements = descEls;
        } else {
            const labelText = labelEls.map(el => el.textContent.trim()).join(' ');
            const descText  = descEls.map(el => el.textContent.trim()).join(' ');
            labelText
                ? this.#inputEl.setAttribute('aria-label', labelText)
                : this.#inputEl.removeAttribute('aria-label');
            descText
                ? this.#inputEl.setAttribute('aria-description', descText)
                : this.#inputEl.removeAttribute('aria-description');
        }
        this.#updateDebug(labelEls, descEls);
    }

    #updateDebug(labelEls, descEls) {
        const set = (sel, val) => { const el = this.shadowRoot.querySelector(sel); if (el) el.textContent = val; };
        set('#db-host-labelledby', this.getAttribute('aria-labelledby') ?? '');
        set('#db-label-text',      labelEls.map(e => e.textContent.trim()).join(', '));
        set('#db-host-describedby',this.getAttribute('aria-describedby') ?? '');
        set('#db-desc-text',       descEls.map(e => e.textContent.trim()).join(', '));
        set('#db-api', SUPPORTS_ELEMENT_REFS
            ? 'ariaLabelledByElements / ariaDescribedByElements'
            : 'aria-label / aria-description (fallback)');
    }
}

customElements.define('checkbox-light', CheckboxLight);
