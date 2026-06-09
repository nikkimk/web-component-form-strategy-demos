import {
    createLogRefresher,
    InnerCrossRootAriaController,
    logInnerCrossRootAriaRefs,
    resolveLightFieldRefs,
} from './cross-root-field-base.js';

/**
 * Textfield with a native inner input as the ARIA surface.
 * Light DOM label/help wire via inner.ariaLabelledByElements / ariaDescribedByElements.
 */
export class TextfieldCrossRootRefs extends HTMLElement {
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
                <input
                    class="textfield-input-native"
                    part="input"
                    type="text"
                    data-aria-surface
                />
            </div>
        `;

        this.#innerInput = this.shadowRoot.querySelector('[data-aria-surface]');

        const logKey = this.getAttribute('data-aria-log') ?? 'textfield-cross-root';
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
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
    }
}

customElements.define('textfield-cross-root-refs', TextfieldCrossRootRefs);
