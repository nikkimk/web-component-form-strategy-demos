import {
    createLogRefresher,
    establishInnerCrossRootAriaSync,
    logInnerCrossRootAriaRefs,
    resolveLightFieldRefs,
} from './cross-root-field-base.js';

/**
 * Checkbox with a native inner input as the ARIA surface.
 * Light DOM label/help wire via inner.ariaLabelledByElements / ariaDescribedByElements.
 */
export class CheckboxCrossRootRefs extends HTMLElement {
    #innerInput = null;
    #labelElements = [];
    #descriptionElements = [];
    #disconnectAria = () => {};
    #refreshLog = () => {};

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                <label class="checkbox-native-surface" part="control">
                    <input
                        class="checkbox-input-native"
                        part="input"
                        type="checkbox"
                        data-aria-surface
                    />
                    <span class="checkbox-label-text" part="label-text" aria-hidden="true">
                        Checkbox
                    </span>
                </label>
            </div>
        `;

        this.#innerInput = this.shadowRoot.querySelector('[data-aria-surface]');

        const resolveRefs = () => {
            const refs = resolveLightFieldRefs(this, {
                labelTarget: this.getAttribute('label-target') ?? '',
                helpTarget: this.getAttribute('help-target') ?? '',
            });
            this.#labelElements = refs.labelElements;
            this.#descriptionElements = refs.descriptionElements;
            return refs;
        };

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox-cross-root';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logInnerCrossRootAriaRefs(
                logEl,
                this.#innerInput,
                this.#labelElements,
                this.#descriptionElements
            );
        });

        this.#disconnectAria = establishInnerCrossRootAriaSync(
            this.#innerInput,
            resolveRefs,
            this.#refreshLog
        );

        this.#innerInput.addEventListener('change', this.#refreshLog);
    }

    disconnectedCallback() {
        this.#disconnectAria();
        this.#innerInput?.removeEventListener('change', this.#refreshLog);
    }
}

customElements.define('checkbox-cross-root-refs', CheckboxCrossRootRefs);
