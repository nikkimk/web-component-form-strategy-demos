import {
    createLogRefresher,
    logHostFieldAriaRefs,
    resolveSplitSurfaceFieldRefs,
    SplitSurfaceAriaController,
} from './form-field-base.js';

/**
 * Text field with role="textbox" on the host.
 * The decorative inner input is aria-hidden; typing is handled on the host.
 */
export class TextfieldHostRefs extends HTMLElement {
    #ariaController = null;
    #internals = null;
    #labelEl = null;
    #helpEl = null;
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
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <span class="field-label" part="label">Email address</span>
                <span class="field-help" part="help">Role is on the host; the inner input is presentational.</span>
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

        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        this.#inputEl = this.shadowRoot.querySelector('.textfield-input');

        const useLightLabel = this.hasAttribute('label-target');

        if (useLightLabel) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'textfield';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logHostFieldAriaRefs(
                logEl,
                this,
                this.#internals,
                this.#labelElements,
                this.#descriptionElements
            );
        });

        this.#ariaController = new SplitSurfaceAriaController({
            host: this,
            internals: this.#internals,
            role: 'textbox',
            resolveRefs: () => {
                const refs = resolveSplitSurfaceFieldRefs(this, {
                    shadowLabelEl: this.#labelEl,
                    shadowHelpEl: this.#helpEl,
                });
                this.#labelElements = refs.labelElements;
                this.#descriptionElements = refs.descriptionElements;
                return refs;
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

customElements.define('textfield-host-refs', TextfieldHostRefs);
