import {
    ComboboxController,
    createLogRefresher,
    logAriaRefs,
    watchSlottedOptions,
} from './combobox-base.js';
import { SlottedFieldAriaController } from './form-field-base.js';

/**
 * Combobox with label and help text slotted from Light DOM.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxSlottedRefs extends HTMLElement {
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
        const labelSlot = this.getAttribute('label-slot') ?? 'label';
        const descriptionSlot = this.getAttribute('description-slot') ?? 'help-text';

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="combobox-host" part="host">
                <div class="field-label-slot" part="label-slot">
                    <slot name="${labelSlot}"></slot>
                </div>
                <div class="field-help-slot" part="description-slot">
                    <slot name="${descriptionSlot}"></slot>
                </div>
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

        const logKey = this.getAttribute('data-aria-log') ?? 'combobox-slotted';
        const refreshLog = createLogRefresher(logKey, (logEl) => {
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

        this.#ariaController = new SlottedFieldAriaController({
            host: this,
            internals: this.#internals,
            role: 'combobox',
            labelSlot,
            helpSlot: descriptionSlot,
            controls: [this.#listbox],
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

customElements.define('combobox-slotted-refs', ComboboxSlottedRefs);
