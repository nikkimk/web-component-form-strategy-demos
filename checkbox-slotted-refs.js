import {
    SUPPORTS_ELEMENT_REFS,
    createLogRefresher,
    logHostFieldAriaRefs,
    SlottedFieldAriaController,
} from './form-field-base.js';

/**
 * Checkbox with label and description slotted from Light DOM.
 */
export class CheckboxSlottedRefs extends HTMLElement {
    #ariaController = null;
    #internals = null;
    #boxEl = null;
    #checked = false;
    #labelElements = [];
    #descriptionElements = [];
    #refreshLog = () => {};

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        const labelSlot = this.getAttribute('label-slot') ?? 'label';
        const descriptionSlot = this.getAttribute('description-slot') ?? 'help-text';

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <div class="field-label-slot" part="label-slot">
                    <slot name="${labelSlot}"></slot>
                </div>
                <div class="field-help-slot" part="description-slot">
                    <slot name="${descriptionSlot}"></slot>
                </div>
                <div class="control-surface checkbox-surface" part="control">
                    <span class="checkbox-box" part="box" aria-hidden="true"></span>
                    <span class="checkbox-label-text" part="label-text">Send me updates</span>
                </div>
            </div>
        `;

        this.#boxEl = this.shadowRoot.querySelector('.checkbox-box');

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox-slotted';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logHostFieldAriaRefs(
                logEl,
                this,
                this.#internals,
                this.#labelElements,
                this.#descriptionElements
            );
        });

        this.#ariaController = new SlottedFieldAriaController({
            host: this,
            internals: this.#internals,
            role: 'checkbox',
            labelSlot,
            helpSlot: descriptionSlot,
            onRefsChange: ({ labelElements, descriptionElements }) => {
                this.#labelElements = labelElements;
                this.#descriptionElements = descriptionElements;
            },
            onSync: () => this.#refreshLog(),
        });
        this.#ariaController.connect();

        this.#setChecked(false);
        this.addEventListener('click', this.#onClick);
        this.addEventListener('keydown', this.#onKeyDown);
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('keydown', this.#onKeyDown);
    }

    /**
     * @param {boolean} nextChecked
     */
    #setChecked(nextChecked) {
        this.#checked = nextChecked;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#internals.ariaChecked = nextChecked;
            this.removeAttribute('aria-checked');
        } else {
            this.setAttribute('aria-checked', String(nextChecked));
        }

        this.#boxEl.classList.toggle('is-checked', nextChecked);
        this.#refreshLog();
    }

    #toggle() {
        this.#setChecked(!this.#checked);
    }

    #onClick(event) {
        event.stopPropagation();
        if (document.activeElement !== this) {
            this.focus();
        }
        this.#toggle();
    }

    /**
     * @param {KeyboardEvent} event
     */
    #onKeyDown(event) {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            this.#toggle();
        }
    }
}

customElements.define('checkbox-slotted-refs', CheckboxSlottedRefs);
