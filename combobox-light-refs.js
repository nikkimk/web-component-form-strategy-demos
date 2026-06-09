import {
    ComboboxController,
    createLogRefresher,
    logAriaRefs,
    SplitSurfaceAriaController,
    watchSlottedOptions,
} from './combobox-base.js';

/**
 * Combobox with label and help text provided in Light DOM.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxLightRefs extends HTMLElement {
    #controller = null;
    #ariaController = null;
    #internals = null;
    #listbox = null;
    #options = [];
    #unwatchSlot = null;
    #labelElements = [];
    #descriptionElements = [];

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="combobox-host" part="host">
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
        const valueEl = this.shadowRoot.querySelector('.combobox-value');
        this.#listbox = this.shadowRoot.querySelector('.combobox-listbox');

        const labelTarget = this.getAttribute('label-target');
        const helpTarget = this.getAttribute('help-target');

        const labelEl = labelTarget
            ? document.getElementById(labelTarget)
            : this.previousElementSibling?.matches('label')
              ? this.previousElementSibling
              : null;

        const helpEl = helpTarget
            ? document.getElementById(helpTarget)
            : this.nextElementSibling?.hasAttribute('data-help')
              ? this.nextElementSibling
              : null;

        this.#labelElements = [labelEl].filter(Boolean);
        this.#descriptionElements = [helpEl].filter(Boolean);

        const refreshLog = createLogRefresher('light', (logEl) => {
            logAriaRefs(
                logEl,
                this,
                this.#internals,
                this.#listbox,
                this.#labelElements,
                this.#descriptionElements,
                this.#options
            );
        });

        this.#ariaController = new SplitSurfaceAriaController({
            host: this,
            internals: this.#internals,
            role: 'combobox',
            controls: [this.#listbox],
            labelElements: this.#labelElements,
            descriptionElements: this.#descriptionElements,
            onRefsChange: ({ labelElements, descriptionElements }) => {
                this.#labelElements = labelElements;
                this.#descriptionElements = descriptionElements;
            },
            onSync: refreshLog,
        });
        this.#ariaController.connect();

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
        this.#ariaController?.disconnect();
        this.#unwatchSlot?.();
        this.#controller?.disconnect();
    }
}

customElements.define('combobox-light-refs', ComboboxLightRefs);
