import {
    createLogRefresher,
    InnerCrossRootAriaController,
    logInnerCrossRootAriaRefs,
    resolveLightFieldRefs,
} from './cross-root-field-base.js';

/**
 * Progress bar with an inner role="progressbar" surface in shadow.
 * Light DOM label/help wire via inner.ariaLabelledByElements / ariaDescribedByElements.
 */
export class ProgressbarCrossRootRefs extends HTMLElement {
    #ariaController = null;
    #innerSurface = null;
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
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <div
                    class="progressbar-surface progressbar-aria-surface"
                    part="control"
                    role="progressbar"
                    data-aria-surface
                    tabindex="-1"
                    aria-valuemin="0"
                >
                    <div class="progressbar-track" aria-hidden="true">
                        <div class="progressbar-fill" part="fill"></div>
                    </div>
                    <span class="progressbar-value" part="value-text" aria-hidden="true"></span>
                </div>
            </div>
        `;

        this.#innerSurface = this.shadowRoot.querySelector('[data-aria-surface]');
        this.#fillEl = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueEl = this.shadowRoot.querySelector('.progressbar-value');

        const logKey = this.getAttribute('data-aria-log') ?? 'progressbar-cross-root';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logInnerCrossRootAriaRefs(
                logEl,
                this.#innerSurface,
                this.#labelElements,
                this.#descriptionElements
            );
        });

        this.#ariaController = new InnerCrossRootAriaController({
            innerSurface: this.#innerSurface,
            resolveRefs: () => {
                const refs = resolveLightFieldRefs(this, {
                    labelTarget: this.getAttribute('label-target') ?? '',
                    helpTarget: this.getAttribute('help-target') ?? '',
                });
                this.#labelElements = refs.labelElements;
                this.#descriptionElements = refs.descriptionElements;
                return refs;
            },
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

        this.#innerSurface.setAttribute('aria-valuenow', String(this.#value));
        this.#innerSurface.setAttribute('aria-valuemax', String(this.#max));
        this.#innerSurface.setAttribute('aria-valuetext', valueText);
        this.#fillEl.style.width = `${percent}%`;
        this.#valueEl.textContent = `${Math.round(percent)}%`;
        this.#refreshLog();
    }
}

customElements.define('progressbar-cross-root-refs', ProgressbarCrossRootRefs);
