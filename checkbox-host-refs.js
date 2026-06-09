import {
    SUPPORTS_ELEMENT_REFS,
    createLogRefresher,
    logHostFieldAriaRefs,
    resolveSplitSurfaceFieldRefs,
    shadowLabelHelpMarkup,
    SplitSurfaceAriaController,
    watchSlottedFieldRefs,
} from './form-field-base.js';

/**
 * Checkbox with role="checkbox" on the host (no native input in the accessibility tree).
 */
export class CheckboxHostRefs extends HTMLElement {
    #ariaController = null;
    #internals = null;
    #labelEl = null;
    #helpEl = null;
    #boxEl = null;
    #checked = false;
    #labelElements = [];
    #descriptionElements = [];
    #refreshLog = () => {};
    #unwatchShadowLabelSlots = () => {};

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                ${shadowLabelHelpMarkup({
                    labelDefault: 'Subscribe to newsletter',
                    helpDefault: 'Space toggles; role and aria-checked are on the host.',
                })}
                <div class="control-surface checkbox-surface" part="control">
                    <span class="checkbox-box" part="box" aria-hidden="true"></span>
                    <span class="checkbox-label-text" part="label-text">Send me updates</span>
                </div>
            </div>
        `;

        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        this.#boxEl = this.shadowRoot.querySelector('.checkbox-box');

        const useLightLabel = this.hasAttribute('label-target');

        if (useLightLabel) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox';
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
            role: 'checkbox',
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

        this.#unwatchShadowLabelSlots = watchSlottedFieldRefs(
            this,
            () => this.#ariaController?.resync(),
            { labelSlot: 'label', helpSlot: 'help-text' }
        );

        this.#setChecked(false);
        this.addEventListener('click', this.#onClick);
        this.addEventListener('keydown', this.#onKeyDown);
    }

    disconnectedCallback() {
        this.#unwatchShadowLabelSlots();
        this.#ariaController?.disconnect();
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('keydown', this.#onKeyDown);
    }

    /**
     * @param {boolean} nextChecked
     */
    #setChecked(nextChecked) {
        this.#checked = nextChecked;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#internals.ariaChecked = nextChecked;
            this.removeAttribute('aria-checked');
        } else {
            this.setAttribute('aria-checked', String(nextChecked));
        }

        this.#boxEl.classList.toggle('is-checked', nextChecked);
        this.#refreshLog();
    }

    #toggle() {
        this.#setChecked(!this.#checked);
    }

    #onClick(event) {
        event.stopPropagation();
        if (document.activeElement !== this) {
            this.focus();
        }
        this.#toggle();
    }

    /**
     * @param {KeyboardEvent} event
     */
    #onKeyDown(event) {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            this.#toggle();
        }
    }
}

customElements.define('checkbox-host-refs', CheckboxHostRefs);
