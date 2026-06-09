import {
    collectSlottedFieldRefs,
    createLogRefresher,
    logHostFieldAriaRefs,
    syncHostFieldAriaRefs,
    watchSlottedFieldRefs,
} from './form-field-base.js';

/**
 * Text field with label and help slotted from Light DOM.
 * Slotted nodes stay in the light tree and wire through host element refs — no cross-root shadow link.
 */
export class TextfieldSlottedRefs extends HTMLElement {
    #internals = null;
    #inputEl = null;
    #value = '';
    #labelElements = [];
    #descriptionElements = [];
    #unwatchSlots = () => {};
    #refreshLog = () => {};

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <div class="field-label-slot" part="label-slot">
                    <slot name="label"></slot>
                </div>
                <div class="field-help-slot" part="help-slot">
                    <slot name="help-text"></slot>
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

        const resyncAria = syncHostFieldAriaRefs(this, this.#internals, 'textbox', [], [], {
            resolveRefs: () => {
                const refs = collectSlottedFieldRefs(this);
                this.#labelElements = refs.labelElements;
                this.#descriptionElements = refs.descriptionElements;
                return refs;
            },
        });

        this.#unwatchSlots = watchSlottedFieldRefs(this, () => {
            resyncAria();
            this.#refreshLog();
        });

        this.#syncDisplay();

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

        this.addEventListener('keydown', this.#onKeyDown);
        this.addEventListener('click', this.#onClick);
    }

    disconnectedCallback() {
        this.#unwatchSlots();
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
