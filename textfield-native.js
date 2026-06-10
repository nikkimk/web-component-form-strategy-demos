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
 * Textfield with a native <input type="text"> in shadow DOM.
 * Role (implicit textbox) lives on the shadow input, not the host.
 * ariaLabelledByElements / ariaDescribedByElements are set on the shadow input directly.
 *
 * Light label scenario:  source (shadow input) → target (light DOM label)  ✓ lighter DOM, works
 * Shadow label scenario: source (shadow input) → target (shadow label span) ✓ same root, works
 */
export class TextfieldNative extends HTMLElement {
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
                    labelDefault: 'Email address',
                    helpDefault: 'Native input in shadow DOM. ariaLabelledByElements is set on the input itself.',
                })}
                <input type="text" class="textfield-input-native" part="input" />
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('.textfield-input-native');
        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');

        if (this.hasAttribute('label-target')) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'textfield-native';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logEl.textContent = this.#buildLog();
        });

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
            // Shadow input → shadow label: same root. Shadow input → light label: target in lighter DOM.
            // Both directions work with the element reference API.
            this.#inputEl.ariaLabelledByElements = prepareRefTargets([...shadowLabels, ...lightLabels]);
            this.#inputEl.ariaDescribedByElements = prepareRefTargets([...shadowDescs, ...lightDescs]);
            this.#inputEl.removeAttribute('aria-labelledby');
            this.#inputEl.removeAttribute('aria-describedby');
            this.#inputEl.removeAttribute('aria-label');
        } else {
            // Fallback: aria-labelledby with a light DOM ID works cross-root via attribute in most browsers.
            // Shadow-only labels mirror their text to aria-label.
            if (lightLabels.length) {
                lightLabels.forEach((el) => ensureFallbackId(el, 'label'));
                this.#inputEl.setAttribute('aria-labelledby', lightLabels.map((el) => el.id).join(' '));
            } else if (shadowLabels.length) {
                this.#inputEl.setAttribute(
                    'aria-label',
                    shadowLabels.map((el) => el.textContent?.trim()).join(' ')
                );
            }
            if (lightDescs.length) {
                lightDescs.forEach((el) => ensureFallbackId(el, 'desc'));
                this.#inputEl.setAttribute('aria-describedby', lightDescs.map((el) => el.id).join(' '));
            }
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.#sync()
        );

        this.#refreshLog();
    }

    #buildLog() {
        const lines = [
            '<input type="text"> (shadow DOM) — implicit role: textbox',
            'ariaLabelledByElements / ariaDescribedByElements set on the shadow input',
        ];

        if (SUPPORTS_ELEMENT_REFS) {
            lines.push(`input.ariaLabelledByElements → ${fmtEls(this.#inputEl.ariaLabelledByElements)}`);
            lines.push(`input.ariaDescribedByElements → ${fmtEls(this.#inputEl.ariaDescribedByElements)}`);
        } else {
            lines.push(`input[aria-labelledby]="${this.#inputEl.getAttribute('aria-labelledby') ?? ''}" (fallback)`);
            lines.push(`input[aria-label]="${this.#inputEl.getAttribute('aria-label') ?? ''}" (fallback)`);
            lines.push(`input[aria-describedby]="${this.#inputEl.getAttribute('aria-describedby') ?? ''}" (fallback)`);
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

customElements.define('textfield-native', TextfieldNative);
