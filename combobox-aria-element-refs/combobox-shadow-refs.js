import {
    ComboboxController,
    logAriaRefs,
    syncAriaElementRefs,
    watchSlottedOptions,
} from './combobox-base.js';

/**
 * Combobox with label and help text rendered inside Shadow DOM.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxShadowRefs extends HTMLElement {
    #controller = null;
    #internals = null;
    #labelEl = null;
    #helpEl = null;
    #listbox = null;
    #options = [];
    #unwatchSlot = null;

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="combobox-host" part="host">
                <label class="field-label" part="label">Favorite fruit</label>
                <span class="field-help" part="help">Choose a fruit from the list. Arrow keys navigate; Enter selects.</span>
                <div class="combobox-trigger" part="trigger">
                    <span class="combobox-value" part="value">Select a fruit</span>
                    <span class="combobox-chevron" aria-hidden="true">▾</span>
                </div>
                <ul class="combobox-listbox" role="listbox" part="listbox" hidden>
                    <slot name="option"></slot>
                </ul>
            </div>
        `;

        const hostSurface = this.shadowRoot.querySelector('.combobox-host');
        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        const valueEl = this.shadowRoot.querySelector('.combobox-value');
        this.#listbox = this.shadowRoot.querySelector('.combobox-listbox');

        syncAriaElementRefs(
            this,
            this.#internals,
            this.#listbox,
            [this.#labelEl],
            [this.#helpEl]
        );

        const logEl = document.querySelector('[data-aria-log="shadow"]');
        const refreshLog = () => {
            if (logEl) {
                logAriaRefs(
                    logEl,
                    this,
                    this.#internals,
                    this.#listbox,
                    [this.#labelEl],
                    [this.#helpEl],
                    this.#options
                );
            }
        };

        this.#unwatchSlot = watchSlottedOptions(this, (options) => {
            if (!options.length) {
                return;
            }

            this.#options = options;
            this.#controller?.disconnect();
            this.#controller = new ComboboxController({
                host: this,
                trigger: hostSurface,
                valueEl,
                listbox: this.#listbox,
                options,
                onActiveDescendantChange: refreshLog,
            });
            this.#controller.connect();
            refreshLog();
        });
    }

    disconnectedCallback() {
        this.#unwatchSlot?.();
        this.#controller?.disconnect();
    }
}

customElements.define('combobox-shadow-refs', ComboboxShadowRefs);
