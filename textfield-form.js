import { LabellingController, LABELLING_DEBUG_HTML, applyLabellingDebug } from './labelling-controller.js';

class TextfieldForm extends HTMLElement {
    static formAssociated = true;

    #internals = this.attachInternals();
    #labelling  = new LabellingController({ onUpdate: () => this.#updateDebug() });
    #inputEl    = null;
    #defaultValue = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() {
        return ['labelledby', 'describedby', 'value', 'disabled', 'required'];
    }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'value')    { this.#defaultValue = val ?? ''; this.#syncValue(); }
        if (name === 'disabled') this.#syncDisabled();
        if (name === 'required') this.#syncRequired();
    }

    // ── labelling ────────────────────────────────────────────────────────────
    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    // ── form participation ───────────────────────────────────────────────────
    get value() { return this.#inputEl?.value ?? ''; }
    set value(val) {
        if (this.#inputEl) this.#inputEl.value = val ?? '';
        this.#internals.setFormValue(val ?? '');
    }

    get form()     { return this.#internals.form; }
    get validity() { return this.#internals.validity; }
    get validationMessage() { return this.#internals.validationMessage; }
    get willValidate()      { return this.#internals.willValidate; }

    checkValidity()  { return this.#internals.checkValidity(); }
    reportValidity() { return this.#internals.reportValidity(); }

    formResetCallback() {
        this.value = this.#defaultValue;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden><slot name="label"></slot></span>
                <input id="role" type="text" class="textfield-input-native" part="input" />
                <span id="description" class="field-help" hidden><slot name="description"></slot></span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">${LABELLING_DEBUG_HTML}</dl>
                </div>
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('#role');
        this.#inputEl.value = this.#defaultValue;
        this.#internals.setFormValue(this.#defaultValue);

        this.#inputEl.addEventListener('input', () => {
            this.#internals.setFormValue(this.#inputEl.value);
        });

        this.#syncDisabled();
        this.#syncRequired();
        this.#labelling.connect(this.shadowRoot);
    }

    #syncValue() {
        if (!this.#inputEl) return;
        this.#inputEl.value = this.#defaultValue;
        this.#internals.setFormValue(this.#defaultValue);
    }

    #syncDisabled() {
        if (this.#inputEl) this.#inputEl.disabled = this.hasAttribute('disabled');
        // Disabled fields are excluded from form data
        this.#internals.setFormValue(this.hasAttribute('disabled') ? null : (this.#inputEl?.value ?? ''));
    }

    #syncRequired() {
        if (this.#inputEl) this.#inputEl.required = this.hasAttribute('required');
    }

    #updateDebug() {
        applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo);
    }
}

customElements.define('textfield-form', TextfieldForm);
