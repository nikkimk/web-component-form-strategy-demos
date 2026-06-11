import { LabellingController, LABELLING_DEBUG_HTML, applyLabellingDebug } from './labelling-controller.js';
import { FieldAssociationController } from './field-association-controller.js';

class CheckboxForm extends HTMLElement {
    static formAssociated = true;

    #internals      = this.attachInternals();
    #labelling      = new LabellingController({ onUpdate: () => this.#updateDebug() });
    #fieldAssoc     = new FieldAssociationController(this.#internals);
    #inputEl        = null;
    #defaultChecked = false;

    constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }); }

    static get observedAttributes() {
        return ['labelledby', 'describedby', 'checked', 'value', 'disabled'];
    }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'checked')  { this.#defaultChecked = val !== null; this.#syncChecked(); }
        if (name === 'disabled') this.#syncDisabled();
        // 'value' attribute change updates what gets submitted but not the default checked state
    }

    // ── Labelling ────────────────────────────────────────────────────────────
    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    // ── Checkbox state ───────────────────────────────────────────────────────
    get checked() { return this.#inputEl?.checked ?? false; }
    set checked(val) {
        if (this.#inputEl) this.#inputEl.checked = Boolean(val);
        this.#updateFormValue();
    }

    // The value submitted when checked — mirrors native checkbox behaviour
    get value() { return this.getAttribute('value') ?? 'on'; }
    set value(val) { this.setAttribute('value', val); this.#updateFormValue(); }

    // ── Form introspection ───────────────────────────────────────────────────
    get form()              { return this.#fieldAssoc.form; }
    get validity()          { return this.#fieldAssoc.validity; }
    get validationMessage() { return this.#fieldAssoc.validationMessage; }
    get willValidate()      { return this.#fieldAssoc.willValidate; }
    checkValidity()         { return this.#fieldAssoc.checkValidity(); }
    reportValidity()        { return this.#fieldAssoc.reportValidity(); }

    formResetCallback() {
        if (this.#inputEl) this.#inputEl.checked = this.#defaultChecked;
        this.#updateFormValue();
    }

    connectedCallback() {
        this.#defaultChecked = this.hasAttribute('checked');

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden><slot name="label"></slot></span>
                <div class="checkbox-native-surface">
                    <input id="role" type="checkbox" class="checkbox-input-native" part="input" />
                </div>
                <span id="description" class="field-help" hidden><slot name="description"></slot></span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">${LABELLING_DEBUG_HTML}</dl>
                </div>
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('#role');
        this.#inputEl.checked = this.#defaultChecked;
        this.#inputEl.addEventListener('change', () => this.#updateFormValue());
        this.#syncDisabled();
        this.#updateFormValue();
        this.#labelling.connect(this.shadowRoot);
    }

    // Unchecked or disabled → null (excluded from FormData), matching native checkbox
    #updateFormValue() {
        this.#fieldAssoc.setValue(
            (this.#inputEl?.checked && !this.hasAttribute('disabled')) ? this.value : null
        );
    }

    #syncChecked() {
        if (this.#inputEl) this.#inputEl.checked = this.#defaultChecked;
        this.#updateFormValue();
    }

    #syncDisabled() {
        if (this.#inputEl) this.#inputEl.disabled = this.hasAttribute('disabled');
        this.#updateFormValue();
    }

    #updateDebug() { applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo); }
}

customElements.define('checkbox-form', CheckboxForm);
