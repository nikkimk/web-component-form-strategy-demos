import {
    ComboboxController,
    logAriaRefs,
    syncAriaElementRefs,
    watchSlottedOptions,
} from './combobox-base.js';

/**
 * Combobox that associates both Light DOM and Shadow DOM elements
 * with the host via ariaLabelledByElements and ariaDescribedByElements.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxMixedRefs extends HTMLElement {
    #controller = null;
    #internals = null;
    #shadowLabelEl = null;
    #shadowHelpEl = null;
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
                <span class="field-label mixed-note" part="shadow-label">(Shadow label supplement)</span>
                <span class="field-help mixed-note" part="shadow-help">(Shadow help supplement)</span>
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
        this.#shadowLabelEl = this.shadowRoot.querySelector('[part="shadow-label"]');
        this.#shadowHelpEl = this.shadowRoot.querySelector('[part="shadow-help"]');
        const valueEl = this.shadowRoot.querySelector('.combobox-value');
        this.#listbox = this.shadowRoot.querySelector('.combobox-listbox');

        const lightLabel = document.getElementById(this.getAttribute('label-target') ?? '');
        const lightHelp = document.getElementById(this.getAttribute('help-target') ?? '');

        const labelElements = [lightLabel, this.#shadowLabelEl].filter(Boolean);
        const descriptionElements = [lightHelp, this.#shadowHelpEl].filter(Boolean);

        syncAriaElementRefs(
            this,
            this.#internals,
            this.#listbox,
            labelElements,
            descriptionElements
        );

        const logEl = document.querySelector('[data-aria-log="mixed"]');
        const refreshLog = () => {
            if (logEl) {
                logAriaRefs(
                    logEl,
                    this,
                    this.#internals,
                    this.#listbox,
                    labelElements,
                    descriptionElements,
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

customElements.define('combobox-mixed-refs', ComboboxMixedRefs);
