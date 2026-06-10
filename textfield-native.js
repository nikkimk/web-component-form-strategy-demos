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
 *
 * Cross-root association (light DOM label → shadow input):
 *   aria-labelledby IDs do NOT work across shadow boundaries.
 *   ariaLabelledByElements does work: source is shadow, target is lighter parent DOM.
 *
 * Same-root association (shadow label → shadow input):
 *   aria-labelledby IDs work within the same shadow root.
 *
 * Note: <label for="id"> cannot target a shadow DOM input — IDs inside shadow roots
 * are not globally accessible.
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
        const useShadowLabels = !this.hasAttribute('label-target');

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                ${useShadowLabels ? shadowLabelHelpMarkup({
                    labelDefault: 'Email address',
                    helpDefault: 'Shadow label and input are in the same root — aria-labelledby IDs work.',
                }) : ''}
                <input type="text" class="textfield-input-native" part="input" />
            </div>
        `;

        this.#inputEl = this.shadowRoot.querySelector('.textfield-input-native');
        this.#labelEl = useShadowLabels ? this.shadowRoot.querySelector('.field-label') : null;
        this.#helpEl = useShadowLabels ? this.shadowRoot.querySelector('.field-help') : null;

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

        // Labels
        if (lightLabels.length && SUPPORTS_ELEMENT_REFS) {
            // Cross-root: light DOM label → shadow input. Requires element refs API.
            this.#inputEl.ariaLabelledByElements = prepareRefTargets(lightLabels);
            this.#inputEl.removeAttribute('aria-labelledby');
        } else if (shadowLabels.length) {
            // Same-root: shadow label → shadow input. ID attribute works.
            shadowLabels.forEach((el) => ensureFallbackId(el, 'label'));
            this.#inputEl.setAttribute('aria-labelledby', shadowLabels.map((el) => el.id).join(' '));
            if (SUPPORTS_ELEMENT_REFS) this.#inputEl.ariaLabelledByElements = [];
        } else {
            this.#inputEl.removeAttribute('aria-labelledby');
            if (SUPPORTS_ELEMENT_REFS) this.#inputEl.ariaLabelledByElements = [];
        }

        // Descriptions
        if (lightDescs.length && SUPPORTS_ELEMENT_REFS) {
            this.#inputEl.ariaDescribedByElements = prepareRefTargets(lightDescs);
            this.#inputEl.removeAttribute('aria-describedby');
        } else if (shadowDescs.length) {
            shadowDescs.forEach((el) => ensureFallbackId(el, 'desc'));
            this.#inputEl.setAttribute('aria-describedby', shadowDescs.map((el) => el.id).join(' '));
            if (SUPPORTS_ELEMENT_REFS) this.#inputEl.ariaDescribedByElements = [];
        } else {
            this.#inputEl.removeAttribute('aria-describedby');
            if (SUPPORTS_ELEMENT_REFS) this.#inputEl.ariaDescribedByElements = [];
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.#sync()
        );

        this.#refreshLog();
    }

    #buildLog() {
        const { shadow: shadowLabels, light: lightLabels } = partitionByRoot(this.#labelElements);
        const { shadow: shadowDescs, light: lightDescs } = partitionByRoot(this.#descriptionElements);
        const lines = [
            '<input type="text"> (shadow DOM) — implicit role: textbox',
        ];

        if (lightLabels.length && SUPPORTS_ELEMENT_REFS) {
            lines.push(`input.ariaLabelledByElements → ${fmtEls(this.#inputEl.ariaLabelledByElements)}`);
        } else {
            lines.push(`input[aria-labelledby]="${this.#inputEl.getAttribute('aria-labelledby') ?? ''}"`);
        }
        if (lightDescs.length && SUPPORTS_ELEMENT_REFS) {
            lines.push(`input.ariaDescribedByElements → ${fmtEls(this.#inputEl.ariaDescribedByElements)}`);
        } else {
            lines.push(`input[aria-describedby]="${this.#inputEl.getAttribute('aria-describedby') ?? ''}"`);
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
