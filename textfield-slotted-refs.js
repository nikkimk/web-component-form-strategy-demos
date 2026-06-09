import {
    createLogRefresher,
    logHostFieldAriaRefs,
    SlottedFieldAriaController,
} from './form-field-base.js';

/**
 * Text field with label and description slotted from Light DOM.
 */
export class TextfieldSlottedRefs extends HTMLElement {
    #ariaController = null;
    #internals = null;
    #inputEl = null;
    #value = '';
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
                <div class="control-surface textfield-surface" part="control">
                    <input
                        class="textfield-input"
                        part="input"
                        type="text"
                        tabindex="-1"
                        aria-hidden="true"
                        readonly
                    />
                </div>
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('.textfield-input');

        const logKey = this.getAttribute('data-aria-log') ?? 'textfield-slotted';
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
            role: 'textbox',
            labelSlot,
            helpSlot: descriptionSlot,
            onRefsChange: ({ labelElements, descriptionElements }) => {
                this.#labelElements = labelElements;
                this.#descriptionElements = descriptionElements;
            },
            onSync: () => this.#refreshLog(),
        });
        this.#ariaController.connect();

        this.#syncDisplay();
        this.addEventListener('keydown', this.#onKeyDown);
        this.addEventListener('click', this.#onClick);
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
        this.removeEventListener('keydown', this.#onKeyDown);
        this.removeEventListener('click', this.#onClick);
    }

    #syncDisplay() {
        this.#inputEl.value = this.#value;
        this.setAttribute('value', this.#value);
        this.#refreshLog();
    }

    #onClick() {
        if (document.activeElement !== this) {
            this.focus();
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    #onKeyDown(event) {
        if (event.key === 'Backspace') {
            event.preventDefault();
            this.#value = this.#value.slice(0, -1);
            this.#syncDisplay();
            return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            this.#value += event.key;
            this.#syncDisplay();
        }
    }
}

customElements.define('textfield-slotted-refs', TextfieldSlottedRefs);
