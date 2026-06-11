import { LabellingController, LABELLING_DEBUG_HTML, applyLabellingDebug } from './labelling-controller.js';
import { FieldAssociationController } from './field-association-controller.js';

const SUPPORTS_ACTIVE_DESCENDANT_ELEMENT = 'ariaActiveDescendantElement' in Element.prototype;

class ComboboxForm extends HTMLElement {
    static formAssociated = true;

    #internals   = this.attachInternals();
    #labelling   = new LabellingController({ onUpdate: () => this.#updateDebug() });
    #fieldAssoc  = new FieldAssociationController(this.#internals);
    #triggerEl   = null;
    #listboxEl   = null;
    #valueEl     = null;
    #options     = [];
    #open        = false;
    #activeIndex = -1;

    constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }); }

    static get observedAttributes() { return ['labelledby', 'describedby', 'disabled']; }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'disabled') this.#syncDisabled();
    }

    // ── Labelling ────────────────────────────────────────────────────────────
    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    // ── Form introspection ───────────────────────────────────────────────────
    get form()              { return this.#fieldAssoc.form; }
    get validity()          { return this.#fieldAssoc.validity; }
    get validationMessage() { return this.#fieldAssoc.validationMessage; }
    get willValidate()      { return this.#fieldAssoc.willValidate; }
    checkValidity()         { return this.#fieldAssoc.checkValidity(); }
    reportValidity()        { return this.#fieldAssoc.reportValidity(); }

    // On reset: clear selection, remove from FormData
    formResetCallback() {
        this.#options.forEach(o => o.setAttribute('aria-selected', 'false'));
        this.#valueEl.textContent = 'Select an option';
        this.#fieldAssoc.setValue(null);
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden><slot name="label"></slot></span>
                <div
                    id="role"
                    class="combobox-trigger"
                    role="combobox"
                    tabindex="0"
                    aria-controls="listbox"
                    aria-expanded="false"
                    aria-haspopup="listbox"
                    part="trigger"
                >
                    <span class="combobox-value" part="value">Select an option</span>
                    <span class="combobox-chevron" aria-hidden="true">&#9662;</span>
                </div>
                <ul id="listbox" class="combobox-listbox" role="listbox" part="listbox" hidden>
                    <slot name="options"></slot>
                </ul>
                <span id="description" class="field-help" hidden><slot name="description"></slot></span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">${LABELLING_DEBUG_HTML}</dl>
                </div>
            </div>
        `;

        this.#triggerEl = this.shadowRoot.querySelector('#role');
        this.#listboxEl = this.shadowRoot.querySelector('#listbox');
        this.#valueEl   = this.shadowRoot.querySelector('.combobox-value');

        const optionSlot = this.shadowRoot.querySelector('slot[name="options"]');
        optionSlot?.addEventListener('slotchange', () => {
            this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
            this.#options = optionSlot.assignedElements().filter(el => el.getAttribute('role') === 'option');
            this.#options.forEach(o => o.addEventListener('click', this.#onOptionClick));
        });

        this.#triggerEl.addEventListener('keydown', this.#onKeyDown);
        this.#triggerEl.addEventListener('click',   this.#onTriggerClick);
        document.addEventListener('click', this.#onDocumentClick);

        this.#fieldAssoc.setValue(null); // nothing selected initially
        this.#syncDisabled();
        this.#labelling.connect(this.shadowRoot);
    }

    disconnectedCallback() {
        this.#triggerEl?.removeEventListener('keydown', this.#onKeyDown);
        this.#triggerEl?.removeEventListener('click',   this.#onTriggerClick);
        document.removeEventListener('click', this.#onDocumentClick);
        this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
    }

    #setExpanded(open) {
        this.#open = open;
        this.#triggerEl.setAttribute('aria-expanded', String(open));
        this.#listboxEl.hidden = !open;
        if (!open) { this.#activeIndex = -1; this.#clearActive(); }
        else {
            const sel = this.#options.findIndex(o => o.getAttribute('aria-selected') === 'true');
            this.#activateOption(sel >= 0 ? sel : 0);
        }
    }

    #activateOption(index) {
        if (index < 0 || index >= this.#options.length) return;
        this.#activeIndex = index;
        const active = this.#options[index];
        this.#options.forEach((o, i) => o.classList.toggle('is-active', i === index));
        active.scrollIntoView({ block: 'nearest' });
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            this.#triggerEl.ariaActiveDescendantElement = active;
        } else {
            if (!active.id) active.id = `cbx-opt-${crypto.randomUUID()}`;
            this.#triggerEl.setAttribute('aria-activedescendant', active.id);
        }
    }

    #clearActive() {
        this.#options.forEach(o => o.classList.remove('is-active'));
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            this.#triggerEl.ariaActiveDescendantElement = null;
        } else {
            this.#triggerEl.removeAttribute('aria-activedescendant');
        }
    }

    #selectOption(index) {
        const opt = this.#options[index];
        if (!opt) return;
        this.#options.forEach(o => o.setAttribute('aria-selected', 'false'));
        opt.setAttribute('aria-selected', 'true');
        const displayText = opt.textContent.trim();
        const formValue   = opt.getAttribute('value') ?? displayText;
        this.#valueEl.textContent = displayText;
        this.#fieldAssoc.setValue(this.hasAttribute('disabled') ? null : formValue);
        this.#setExpanded(false);
        this.#triggerEl.focus();
    }

    #syncDisabled() {
        if (!this.#triggerEl) return;
        const disabled = this.hasAttribute('disabled');
        this.#triggerEl.setAttribute('tabindex', disabled ? '-1' : '0');
        this.#triggerEl.setAttribute('aria-disabled', String(disabled));
        const sel = this.#options.find(o => o.getAttribute('aria-selected') === 'true');
        this.#fieldAssoc.setValue(
            disabled || !sel ? null : (sel.getAttribute('value') ?? sel.textContent.trim())
        );
    }

    #onKeyDown = event => {
        if (this.hasAttribute('disabled')) return;
        switch (event.key) {
            case 'ArrowDown': event.preventDefault();
                this.#open ? this.#activateOption(Math.min(this.#activeIndex + 1, this.#options.length - 1)) : this.#setExpanded(true); break;
            case 'ArrowUp': event.preventDefault();
                this.#open ? this.#activateOption(Math.max(this.#activeIndex - 1, 0)) : this.#setExpanded(true); break;
            case 'Enter': case ' ': event.preventDefault();
                this.#open && this.#activeIndex >= 0 ? this.#selectOption(this.#activeIndex) : this.#setExpanded(!this.#open); break;
            case 'Escape': event.preventDefault(); this.#setExpanded(false); break;
            case 'Home': if (this.#open) { event.preventDefault(); this.#activateOption(0); } break;
            case 'End':  if (this.#open) { event.preventDefault(); this.#activateOption(this.#options.length - 1); } break;
        }
    };

    #onTriggerClick = event => {
        if (this.hasAttribute('disabled')) return;
        event.stopPropagation();
        this.#triggerEl.focus();
        this.#setExpanded(!this.#open);
    };

    #onOptionClick = event => {
        event.stopPropagation();
        const i = this.#options.indexOf(event.currentTarget);
        if (i >= 0) this.#selectOption(i);
    };

    #onDocumentClick = event => {
        if (this.#open && !event.composedPath().includes(this)) this.#setExpanded(false);
    };

    #updateDebug() { applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo); }
}

customElements.define('combobox-form', ComboboxForm);
