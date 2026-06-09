import {
    SUPPORTS_ELEMENT_REFS,
    createLogRefresher,
    logHostFieldAriaRefs,
    resolveSplitSurfaceFieldRefs,
    SplitSurfaceAriaController,
} from './form-field-base.js';

/**
 * Progress bar with role="progressbar" on the host.
 * Label and description live in Shadow DOM; the visual track is presentational.
 */
export class ProgressbarHostRefs extends HTMLElement {
    #ariaController = null;
    #internals = null;
    #labelEl = null;
    #helpEl = null;
    #fillEl = null;
    #valueEl = null;
    #value = 0;
    #max = 100;
    #intervalId = null;
    #labelElements = [];
    #descriptionElements = [];
    #refreshLog = () => {};

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <span class="field-label" part="label">Upload progress</span>
                <span class="field-help" part="help">
                    Label and description are in shadow; role and value live on internals.
                </span>
                <div class="control-surface progressbar-surface" part="control" aria-hidden="true">
                    <div class="progressbar-track" part="track">
                        <div class="progressbar-fill" part="fill"></div>
                    </div>
                    <span class="progressbar-value" part="value-text"></span>
                </div>
            </div>
        `;

        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        this.#fillEl = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueEl = this.shadowRoot.querySelector('.progressbar-value');

        const useLightLabel = this.hasAttribute('label-target');

        if (useLightLabel) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'progressbar';
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
            role: 'progressbar',
            resolveRefs: () => {
                const refs = resolveSplitSurfaceFieldRefs(this, {
                    shadowLabelEl: this.#labelEl,
                    shadowHelpEl: this.#helpEl,
                });
                this.#labelElements = refs.labelElements;
                this.#descriptionElements = refs.descriptionElements;
                return refs;
            },
            focusable: false,
            onSync: () => this.#refreshLog(),
        });
        this.#ariaController.connect();

        this.#setValue(Number(this.getAttribute('value') ?? 0));

        if (!this.hasAttribute('value')) {
            this.#startDemoAnimation();
        }
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
        this.#stopDemoAnimation();
    }

    #startDemoAnimation() {
        this.#stopDemoAnimation();
        this.#intervalId = window.setInterval(() => {
            const nextValue = this.#value >= this.#max ? 0 : this.#value + 5;
            this.#setValue(nextValue);
        }, 800);
    }

    #stopDemoAnimation() {
        if (this.#intervalId !== null) {
            window.clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
    }

    /**
     * @param {number} nextValue
     */
    #setValue(nextValue) {
        this.#value = Math.min(this.#max, Math.max(0, nextValue));
        const percent = (this.#value / this.#max) * 100;
        const valueText = `${Math.round(percent)} percent complete`;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#internals.ariaValueNow = this.#value;
            this.#internals.ariaValueMin = 0;
            this.#internals.ariaValueMax = this.#max;
            this.#internals.ariaValueText = valueText;
            this.removeAttribute('aria-valuenow');
            this.removeAttribute('aria-valuemin');
            this.removeAttribute('aria-valuemax');
            this.removeAttribute('aria-valuetext');
        } else {
            this.setAttribute('aria-valuenow', String(this.#value));
            this.setAttribute('aria-valuemin', '0');
            this.setAttribute('aria-valuemax', String(this.#max));
            this.setAttribute('aria-valuetext', valueText);
        }

        this.#fillEl.style.width = `${percent}%`;
        this.#valueEl.textContent = `${Math.round(percent)}%`;
        this.#refreshLog();
    }
}

customElements.define('progressbar-host-refs', ProgressbarHostRefs);
