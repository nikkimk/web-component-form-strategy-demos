import {
    logHostFieldAriaRefs,
    resolveLightFieldRefs,
    syncHostFieldAriaRefs,
} from './form-field-base.js';

/**
 * Text field with role="textbox" on the host.
 * The decorative inner input is aria-hidden; typing is handled on the host.
 */
export class TextfieldHostRefs extends HTMLElement {
    #internals = null;
    #labelEl = null;
    #helpEl = null;
    #inputEl = null;
    #value = '';

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <label class="field-label" part="label">Email address</label>
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

        const { labelElements, descriptionElements } = useLightLabel
            ? resolveLightFieldRefs(this, {
                  labelTarget: this.getAttribute('label-target') ?? '',
                  helpTarget: this.getAttribute('help-target') ?? '',
              })
            : { labelElements: [this.#labelEl], descriptionElements: [this.#helpEl] };

        if (useLightLabel) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        syncHostFieldAriaRefs(
            this,
            this.#internals,
            'textbox',
            labelElements,
            descriptionElements
        );

        this.setAttribute('value', '');
        this.#syncDisplay();

        const logKey = this.getAttribute('data-aria-log') ?? 'textfield';
        const logEl = document.querySelector(`[data-aria-log="${logKey}"]`);
        const refreshLog = () => {
            if (logEl) {
                logHostFieldAriaRefs(
                    logEl,
                    this,
                    this.#internals,
                    labelElements,
                    descriptionElements
                );
            }
        };

        this.addEventListener('keydown', this.#onKeyDown);
        this.addEventListener('click', this.#onClick);
        refreshLog();
        this.#refreshLog = refreshLog;
    }

    #refreshLog = () => {};

    disconnectedCallback() {
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
