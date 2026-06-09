import {
    ComboboxController,
    createLogRefresher,
    logAriaRefs,
    SplitSurfaceAriaController,
    watchSlottedOptions,
} from './combobox-base.js';

/**
 * Combobox with label and help text rendered inside Shadow DOM.
 * Options are slotted from Light DOM into the Shadow DOM listbox.
 */
export class ComboboxShadowRefs extends HTMLElement {
    #controller = null;
    #ariaController = null;
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
                <span class="field-label" part="label">Favorite fruit</span>
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

        const logKey = this.getAttribute('data-aria-log') ?? 'combobox-shadow';
        const refreshLog = createLogRefresher(logKey, (logEl) => {
            logAriaRefs(
                logEl,
                this,
                this.#internals,
                this.#listbox,
                [this.#labelEl],
                [this.#helpEl],
                this.#options
            );
        });

        this.#ariaController = new SplitSurfaceAriaController({
            host: this,
            internals: this.#internals,
            role: 'combobox',
            controls: [this.#listbox],
            labelElements: [this.#labelEl],
            descriptionElements: [this.#helpEl],
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

customElements.define('combobox-shadow-refs', ComboboxShadowRefs);
