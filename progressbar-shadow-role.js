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
 * Progress bar with role="progressbar" on an inner shadow DOM div.
 * ariaLabelledByElements / ariaDescribedByElements are set on that shadow div.
 * aria-value* attributes are also set directly on the shadow div.
 */
export class ProgressbarShadowRole extends HTMLElement {
    #progressbarEl = null;
    #labelEl = null;
    #helpEl = null;
    #fillEl = null;
    #valueEl = null;
    #labelElements = [];
    #descriptionElements = [];
    #value = 0;
    #max = 100;
    #intervalId = null;
    #refreshLog = () => {};
    #unwatchSlots = () => {};
    #unwatchTargets = () => {};

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.#max = Number(this.getAttribute('max') ?? 100);

        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host" part="host">
                ${shadowLabelHelpMarkup({
                    labelDefault: 'Upload progress',
                    helpDefault: 'role="progressbar" is on a shadow div. ariaLabelledByElements is set on that div.',
                })}
                <div
                    class="progressbar-surface"
                    role="progressbar"
                    part="progressbar"
                >
                    <div class="progressbar-track" aria-hidden="true">
                        <div class="progressbar-fill" part="fill"></div>
                    </div>
                    <span class="progressbar-value" aria-hidden="true" part="value-text"></span>
                </div>
            </div>
        `;

        this.#progressbarEl = this.shadowRoot.querySelector('[role="progressbar"]');
        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        this.#fillEl = this.shadowRoot.querySelector('.progressbar-fill');
        this.#valueEl = this.shadowRoot.querySelector('.progressbar-value');

        if (this.hasAttribute('label-target')) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'progressbar-shadow-role';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logEl.textContent = this.#buildLog();
        });

        this.#sync();
        this.#unwatchSlots = watchSlottedFieldRefs(this, () => this.#sync());

        this.#setValue(Number(this.getAttribute('value') ?? 0));
        if (!this.hasAttribute('value')) {
            this.#startAnimation();
        }
    }

    disconnectedCallback() {
        this.#unwatchSlots();
        this.#unwatchTargets();
        this.#stopAnimation();
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
            this.#progressbarEl.ariaLabelledByElements = prepareRefTargets([...shadowLabels, ...lightLabels]);
            this.#progressbarEl.ariaDescribedByElements = prepareRefTargets([...shadowDescs, ...lightDescs]);
            this.#progressbarEl.removeAttribute('aria-labelledby');
            this.#progressbarEl.removeAttribute('aria-describedby');
            this.#progressbarEl.removeAttribute('aria-label');
        } else {
            const allLabels = [...shadowLabels, ...lightLabels];
            const allDescs = [...shadowDescs, ...lightDescs];

            if (allLabels.length) {
                allLabels.forEach((el) => ensureFallbackId(el, 'label'));
                this.#progressbarEl.setAttribute('aria-labelledby', allLabels.map((el) => el.id).join(' '));
            } else {
                this.#progressbarEl.removeAttribute('aria-labelledby');
            }
            if (allDescs.length) {
                allDescs.forEach((el) => ensureFallbackId(el, 'desc'));
                this.#progressbarEl.setAttribute('aria-describedby', allDescs.map((el) => el.id).join(' '));
            } else {
                this.#progressbarEl.removeAttribute('aria-describedby');
            }
            this.#progressbarEl.removeAttribute('aria-label');
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.#sync()
        );

        this.#refreshLog();
    }

    /** @param {number} nextValue */
    #setValue(nextValue) {
        this.#value = Math.min(this.#max, Math.max(0, nextValue));
        const percent = (this.#value / this.#max) * 100;
        const valueText = `${Math.round(percent)} percent complete`;

        // Set value attributes directly on the shadow role element (no ElementInternals needed).
        this.#progressbarEl.setAttribute('aria-valuenow', String(this.#value));
        this.#progressbarEl.setAttribute('aria-valuemin', '0');
        this.#progressbarEl.setAttribute('aria-valuemax', String(this.#max));
        this.#progressbarEl.setAttribute('aria-valuetext', valueText);

        this.#fillEl.style.width = `${percent}%`;
        this.#valueEl.textContent = `${Math.round(percent)}%`;
        this.#refreshLog();
    }

    #startAnimation() {
        this.#stopAnimation();
        this.#intervalId = window.setInterval(() => {
            const next = this.#value >= this.#max ? 0 : this.#value + 5;
            this.#setValue(next);
        }, 800);
    }

    #stopAnimation() {
        if (this.#intervalId !== null) {
            window.clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
    }

    #buildLog() {
        const el = this.#progressbarEl;
        const lines = [
            '<div role="progressbar"> in shadow DOM',
            'ariaLabelledByElements / ariaDescribedByElements set on the shadow div',
        ];

        if (SUPPORTS_ELEMENT_REFS) {
            lines.push(`progressbar.ariaLabelledByElements → ${fmtEls(el.ariaLabelledByElements)}`);
            lines.push(`progressbar.ariaDescribedByElements → ${fmtEls(el.ariaDescribedByElements)}`);
        } else {
            lines.push(`progressbar[aria-labelledby]="${el.getAttribute('aria-labelledby') ?? ''}" (fallback)`);
            lines.push(`progressbar[aria-describedby]="${el.getAttribute('aria-describedby') ?? ''}" (fallback)`);
        }

        lines.push(`aria-valuenow="${el.getAttribute('aria-valuenow') ?? ''}"`);
        lines.push(`aria-valuemin="${el.getAttribute('aria-valuemin') ?? ''}"`);
        lines.push(`aria-valuemax="${el.getAttribute('aria-valuemax') ?? ''}"`);
        lines.push(`aria-valuetext="${el.getAttribute('aria-valuetext') ?? ''}"`);

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

customElements.define('progressbar-shadow-role', ProgressbarShadowRole);
