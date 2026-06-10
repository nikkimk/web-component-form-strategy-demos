class TextfieldShadow extends HTMLElement {
    #inputEl = null;
    #labelEl = null;
    #descEl = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label">
                    <slot name="label">Label</slot>
                </span>
                <input
                    id="input"
                    type="text"
                    class="textfield-input-native"
                    aria-labelledby="label"
                    aria-describedby="description"
                    part="input"
                />
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

        this.#inputEl  = this.shadowRoot.querySelector('#input');
        this.#labelEl  = this.shadowRoot.querySelector('#label');
        this.#descEl   = this.shadowRoot.querySelector('#description');

        this.shadowRoot.querySelectorAll('slot').forEach(s =>
            s.addEventListener('slotchange', () => this.#updateDebug())
        );
        this.#updateDebug();
    }

    #updateDebug() {
        const set = (sel, val) => {
            const el = this.shadowRoot.querySelector(sel);
            if (el) el.textContent = val;
        };
        set('#db-labelledby',  this.#inputEl.getAttribute('aria-labelledby') ?? '');
        set('#db-label-text',  this.#labelEl.textContent.trim());
        set('#db-describedby', this.#inputEl.getAttribute('aria-describedby') ?? '');
        set('#db-desc-text',   this.#descEl.textContent.trim());
    }
}

customElements.define('textfield-shadow', TextfieldShadow);
