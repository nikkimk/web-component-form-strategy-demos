import {
    logHostFieldAriaRefs,
    resolveLightFieldRefs,
    resolveLogElement,
    syncHostFieldAriaRefs,
} from './form-field-base.js';

/**
 * Checkbox with role="checkbox" on the host (no native input in the accessibility tree).
 */
export class CheckboxHostRefs extends HTMLElement {
    #internals = null;
    #labelEl = null;
    #helpEl = null;
    #boxEl = null;
    #checked = false;
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
                <span class="field-label" part="label">Subscribe to newsletter</span>
                <span class="field-help" part="help">Space toggles; role and aria-checked are on the host.</span>
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
            'checkbox',
            labelElements,
            descriptionElements
        );

        this.#setChecked(false);

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox';
        const logEl = resolveLogElement(logKey);
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

        this.addEventListener('click', this.#onClick);
        this.addEventListener('keydown', this.#onKeyDown);
        refreshLog();
        this.#refreshLog = refreshLog;
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.#onClick);
        this.removeEventListener('keydown', this.#onKeyDown);
    }

    /**
     * @param {boolean} nextChecked
     */
    #setChecked(nextChecked) {
        this.#checked = nextChecked;
        this.setAttribute('aria-checked', String(nextChecked));
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
