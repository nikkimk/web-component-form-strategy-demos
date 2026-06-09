import {
    createLogRefresher,
    InnerCrossRootAriaController,
    logInnerCrossRootAriaRefs,
    resolveLightFieldRefs,
} from './cross-root-field-base.js';

/**
 * Checkbox with a native inner input as the ARIA surface.
 * Light DOM label/help wire via inner.ariaLabelledByElements / ariaDescribedByElements.
 */
export class CheckboxCrossRootRefs extends HTMLElement {
    #ariaController = null;
    #innerInput = null;
    #labelElements = [];
    #descriptionElements = [];
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

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox-cross-root';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logInnerCrossRootAriaRefs(
                logEl,
                this.#innerInput,
                this.#labelElements,
                this.#descriptionElements
            );
        });

        this.#ariaController = new InnerCrossRootAriaController({
            innerSurface: this.#innerInput,
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

        this.#innerInput.addEventListener('change', this.#refreshLog);
    }

    disconnectedCallback() {
        this.#innerInput?.removeEventListener('change', this.#refreshLog);
        this.#ariaController?.disconnect();
    }
}

customElements.define('checkbox-cross-root-refs', CheckboxCrossRootRefs);
