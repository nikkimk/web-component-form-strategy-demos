import {
    createLogRefresher,
    shadowLabelHelpMarkup,
    watchRefTargets,
    watchSlottedFieldRefs,
    resolveSplitSurfaceFieldRefs,
} from './form-field-base.js';
import { ensureFallbackId } from './aria-ref-utils.js';

/**
 * Checkbox with a native <input type="checkbox"> in shadow DOM.
 * Role (implicit checkbox) lives on the shadow input, not the host.
 *
 * aria-labelledby and aria-describedby are set as attributes on the shadow input,
 * referencing element IDs. Same-root IDs (shadow label → shadow input) work reliably.
 * Cross-root light DOM IDs also work in most browsers via the attribute.
 *
 * Note: <label for="id"> cannot target a shadow DOM input — IDs inside shadow roots
 * are not globally accessible. aria-labelledby is the correct wiring mechanism here.
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
                    helpDefault: 'Native checkbox in shadow DOM. aria-labelledby is set on the input via element IDs.',
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

        if (this.#labelElements.length) {
            this.#labelElements.forEach((el) => ensureFallbackId(el, 'label'));
            this.#inputEl.setAttribute('aria-labelledby', this.#labelElements.map((el) => el.id).join(' '));
        } else {
            this.#inputEl.removeAttribute('aria-labelledby');
        }

        if (this.#descriptionElements.length) {
            this.#descriptionElements.forEach((el) => ensureFallbackId(el, 'desc'));
            this.#inputEl.setAttribute('aria-describedby', this.#descriptionElements.map((el) => el.id).join(' '));
        } else {
            this.#inputEl.removeAttribute('aria-describedby');
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
            'aria-labelledby / aria-describedby set as attributes on the shadow input',
            `input[aria-labelledby]="${this.#inputEl.getAttribute('aria-labelledby') ?? ''}"`,
            `input[aria-describedby]="${this.#inputEl.getAttribute('aria-describedby') ?? ''}"`,
            `input.checked = ${this.#inputEl.checked}`,
        ];

        this.#labelElements.forEach((el, i) =>
            lines.push(`label[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );
        this.#descriptionElements.forEach((el, i) =>
            lines.push(`description[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );

        return lines.join('\n');
    }
}

function fmtEl(el) {
    const id = el.id ? `#${el.id}` : '';
    const tree = el.getRootNode() instanceof ShadowRoot ? '(shadow)' : '(light)';
    return `${el.tagName.toLowerCase()}${id}${tree}`;
}

customElements.define('checkbox-native', CheckboxNative);
