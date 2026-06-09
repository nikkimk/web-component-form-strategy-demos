import {
    ComboboxController,
    logAriaRefs,
    syncAriaElementRefs,
    watchSlottedOptions,
} from './combobox-base.js';

/**
 * Combobox with label and help text provided in Light DOM.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxLightRefs extends HTMLElement {
    #controller = null;
    #internals = null;
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

        const labelElements = [labelEl].filter(Boolean);
        const descriptionElements = [helpEl].filter(Boolean);

        syncAriaElementRefs(
            this,
            this.#internals,
            this.#listbox,
            labelElements,
            descriptionElements
        );

        const logEl = document.querySelector('[data-aria-log="light"]');
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

customElements.define('combobox-light-refs', ComboboxLightRefs);
