import {
    SUPPORTS_ELEMENT_REFS,
    createLogRefresher,
    shadowLabelHelpMarkup,
    watchRefTargets,
    watchSlottedFieldRefs,
    resolveSplitSurfaceFieldRefs,
} from './form-field-base.js';
import { ensureFallbackId, partitionByRoot, prepareRefTargets } from './aria-ref-utils.js';

/**
 * Checkbox with a native <input type="checkbox"> in shadow DOM.
 * Role (implicit checkbox) lives on the shadow input, not the host.
 * ariaLabelledByElements / ariaDescribedByElements are set on the shadow input directly.
 *
 * Note: <label for="id"> cannot target a shadow DOM input — IDs inside shadow roots are
 * not globally accessible. ariaLabelledByElements is the correct wiring mechanism.
 */
export class CheckboxNative extends HTMLElement {
    #inputEl = null;
    #labelEl = null;
    #helpEl = null;
    #labelElements = [];
    #descriptionElements = [];
    #refreshLog = () => {};
    #unwatchSlots = () => {};
    #unwatchTargets = () => {};

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                ${shadowLabelHelpMarkup({
                    labelDefault: 'Subscribe to newsletter',
                    helpDefault: 'Native checkbox in shadow DOM. ariaLabelledByElements is set on the input.',
                })}
                <div class="checkbox-native-surface" part="control">
                    <input type="checkbox" class="checkbox-input-native" part="input" />
                </div>
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('.checkbox-input-native');
        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');

        if (this.hasAttribute('label-target')) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'checkbox-native';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logEl.textContent = this.#buildLog();
        });

        this.#inputEl.addEventListener('change', () => this.#refreshLog());

        this.#sync();
        this.#unwatchSlots = watchSlottedFieldRefs(this, () => this.#sync());
    }

    disconnectedCallback() {
        this.#unwatchSlots();
        this.#unwatchTargets();
    }

    #sync() {
        this.#unwatchTargets();

        const { labelElements, descriptionElements } = resolveSplitSurfaceFieldRefs(this, {
            shadowLabelEl: this.#labelEl,
            shadowHelpEl: this.#helpEl,
        });

        this.#labelElements = labelElements.filter(Boolean);
        this.#descriptionElements = descriptionElements.filter(Boolean);

        const { shadow: shadowLabels, light: lightLabels } = partitionByRoot(this.#labelElements);
        const { shadow: shadowDescs, light: lightDescs } = partitionByRoot(this.#descriptionElements);

        if (SUPPORTS_ELEMENT_REFS) {
            this.#inputEl.ariaLabelledByElements = prepareRefTargets([...shadowLabels, ...lightLabels]);
            this.#inputEl.ariaDescribedByElements = prepareRefTargets([...shadowDescs, ...lightDescs]);
            this.#inputEl.removeAttribute('aria-labelledby');
            this.#inputEl.removeAttribute('aria-describedby');
            this.#inputEl.removeAttribute('aria-label');
        } else {
            const allLabels = [...shadowLabels, ...lightLabels];
            const allDescs = [...shadowDescs, ...lightDescs];

            if (allLabels.length) {
                allLabels.forEach((el) => ensureFallbackId(el, 'label'));
                this.#inputEl.setAttribute('aria-labelledby', allLabels.map((el) => el.id).join(' '));
            } else {
                this.#inputEl.removeAttribute('aria-labelledby');
            }
            if (allDescs.length) {
                allDescs.forEach((el) => ensureFallbackId(el, 'desc'));
                this.#inputEl.setAttribute('aria-describedby', allDescs.map((el) => el.id).join(' '));
            } else {
                this.#inputEl.removeAttribute('aria-describedby');
            }
            this.#inputEl.removeAttribute('aria-label');
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.#sync()
        );

        this.#refreshLog();
    }

    #buildLog() {
        const lines = [
            '<input type="checkbox"> (shadow DOM) — implicit role: checkbox',
            'ariaLabelledByElements / ariaDescribedByElements set on the shadow input',
        ];

        if (SUPPORTS_ELEMENT_REFS) {
            lines.push(`input.ariaLabelledByElements → ${fmtEls(this.#inputEl.ariaLabelledByElements)}`);
            lines.push(`input.ariaDescribedByElements → ${fmtEls(this.#inputEl.ariaDescribedByElements)}`);
            lines.push(`input.checked = ${this.#inputEl.checked}`);
        } else {
            lines.push(`input[aria-labelledby]="${this.#inputEl.getAttribute('aria-labelledby') ?? ''}" (fallback)`);
            lines.push(`input[aria-describedby]="${this.#inputEl.getAttribute('aria-describedby') ?? ''}" (fallback)`);
            lines.push(`input.checked = ${this.#inputEl.checked}`);
        }

        this.#labelElements.forEach((el, i) =>
            lines.push(`label[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );
        this.#descriptionElements.forEach((el, i) =>
            lines.push(`description[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );

        return lines.join('\n');
    }
}

function fmtEls(elements) {
    if (!elements?.length) return '[]';
    return `[${elements.map(fmtEl).join(', ')}]`;
}

function fmtEl(el) {
    const id = el.id ? `#${el.id}` : '';
    const tree = el.getRootNode() instanceof ShadowRoot ? '(shadow)' : '(light)';
    return `${el.tagName.toLowerCase()}${id}${tree}`;
}

customElements.define('checkbox-native', CheckboxNative);
