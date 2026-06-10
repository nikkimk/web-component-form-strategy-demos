import {
    SUPPORTS_ELEMENT_REFS,
    createLogRefresher,
    shadowLabelHelpMarkup,
    watchRefTargets,
    watchSlottedFieldRefs,
    resolveSplitSurfaceFieldRefs,
} from './form-field-base.js';
import { ensureFallbackId, partitionByRoot, prepareRefTargets } from './aria-ref-utils.js';
import { watchSlottedOptions } from './combobox-base.js';

/**
 * Combobox with role="combobox" on an inner shadow DOM trigger div.
 * The shadow listbox (<ul role="listbox">) is also in shadow DOM.
 * Options are slotted from light DOM into the shadow listbox.
 *
 * ariaLabelledByElements / ariaDescribedByElements → set on the shadow trigger div.
 * ariaControlsElements → trigger (shadow) to listbox (same shadow root) — always works.
 * aria-activedescendant → attribute on trigger, referencing option IDs in light DOM — works.
 *
 * No ElementInternals used: role is an HTML attribute on the shadow element.
 */
export class ComboboxShadowRole extends HTMLElement {
    #triggerEl = null;
    #listboxEl = null;
    #labelEl = null;
    #helpEl = null;
    #valueEl = null;
    #options = [];
    #open = false;
    #activeIndex = -1;
    #labelElements = [];
    #descriptionElements = [];
    #refreshLog = () => {};
    #unwatchOptionSlot = () => {};
    #unwatchLabelSlots = () => {};
    #unwatchTargets = () => {};

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="combobox-host" part="host">
                ${shadowLabelHelpMarkup({
                    labelDefault: 'Favorite fruit',
                    helpDefault: 'Arrow keys navigate; Enter or Space selects. role="combobox" is on the shadow trigger div.',
                })}
                <div
                    class="combobox-trigger"
                    role="combobox"
                    tabindex="0"
                    aria-haspopup="listbox"
                    aria-expanded="false"
                    part="trigger"
                >
                    <span class="combobox-value" part="value">Select a fruit</span>
                    <span class="combobox-chevron" aria-hidden="true">&#9662;</span>
                </div>
                <ul class="combobox-listbox" role="listbox" hidden part="listbox">
                    <slot name="option"></slot>
                </ul>
            </div>
        `;

        this.#triggerEl = this.shadowRoot.querySelector('.combobox-trigger');
        this.#listboxEl = this.shadowRoot.querySelector('.combobox-listbox');
        this.#labelEl = this.shadowRoot.querySelector('.field-label');
        this.#helpEl = this.shadowRoot.querySelector('.field-help');
        this.#valueEl = this.shadowRoot.querySelector('.combobox-value');

        if (this.hasAttribute('label-target')) {
            this.#labelEl.hidden = true;
            this.#helpEl.hidden = true;
        }

        const logKey = this.getAttribute('data-aria-log') ?? 'combobox-shadow-role';
        this.#refreshLog = createLogRefresher(logKey, (logEl) => {
            logEl.textContent = this.#buildLog();
        });

        this.#syncAriaRefs();
        this.#unwatchLabelSlots = watchSlottedFieldRefs(this, () => this.#syncAriaRefs());

        this.#triggerEl.addEventListener('keydown', this.#onKeyDown);
        this.#triggerEl.addEventListener('click', this.#onTriggerClick);
        document.addEventListener('click', this.#onDocumentClick);

        this.#unwatchOptionSlot = watchSlottedOptions(this, (options) => {
            this.#options.forEach((opt) => opt.removeEventListener('click', this.#onOptionClick));
            this.#options = options;
            this.#options.forEach((opt) => opt.addEventListener('click', this.#onOptionClick));
            this.#refreshLog();
        });
    }

    disconnectedCallback() {
        this.#unwatchOptionSlot();
        this.#unwatchLabelSlots();
        this.#unwatchTargets();
        this.#triggerEl?.removeEventListener('keydown', this.#onKeyDown);
        this.#triggerEl?.removeEventListener('click', this.#onTriggerClick);
        document.removeEventListener('click', this.#onDocumentClick);
        this.#options.forEach((opt) => opt.removeEventListener('click', this.#onOptionClick));
    }

    #syncAriaRefs() {
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
            this.#triggerEl.ariaLabelledByElements = prepareRefTargets([...shadowLabels, ...lightLabels]);
            this.#triggerEl.ariaDescribedByElements = prepareRefTargets([...shadowDescs, ...lightDescs]);
            // Same shadow root: trigger → listbox. No cross-root restriction applies.
            this.#triggerEl.ariaControlsElements = [this.#listboxEl];
            this.#triggerEl.removeAttribute('aria-labelledby');
            this.#triggerEl.removeAttribute('aria-describedby');
            this.#triggerEl.removeAttribute('aria-label');
        } else {
            const allLabels = [...shadowLabels, ...lightLabels];
            const allDescs = [...shadowDescs, ...lightDescs];

            if (allLabels.length) {
                allLabels.forEach((el) => ensureFallbackId(el, 'label'));
                this.#triggerEl.setAttribute('aria-labelledby', allLabels.map((el) => el.id).join(' '));
            } else {
                this.#triggerEl.removeAttribute('aria-labelledby');
            }
            if (allDescs.length) {
                allDescs.forEach((el) => ensureFallbackId(el, 'desc'));
                this.#triggerEl.setAttribute('aria-describedby', allDescs.map((el) => el.id).join(' '));
            } else {
                this.#triggerEl.removeAttribute('aria-describedby');
            }
            this.#triggerEl.removeAttribute('aria-label');
            ensureFallbackId(this.#listboxEl, 'listbox');
            this.#triggerEl.setAttribute('aria-controls', this.#listboxEl.id);
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.#syncAriaRefs()
        );

        this.#refreshLog();
    }

    /** @param {boolean} nextOpen */
    #setExpanded(nextOpen) {
        this.#open = nextOpen;
        this.#triggerEl.setAttribute('aria-expanded', String(nextOpen));
        this.#listboxEl.hidden = !nextOpen;

        if (!nextOpen) {
            this.#activeIndex = -1;
            this.#options.forEach((opt) => opt.setAttribute('aria-selected', 'false'));
            this.#triggerEl.removeAttribute('aria-activedescendant');
            this.#refreshLog();
            return;
        }

        const selectedIndex = this.#options.findIndex(
            (opt) => opt.getAttribute('aria-selected') === 'true'
        );
        this.#activateOption(selectedIndex >= 0 ? selectedIndex : 0);
    }

    /** @param {number} index */
    #activateOption(index) {
        if (index < 0 || index >= this.#options.length) return;
        this.#activeIndex = index;
        this.#options.forEach((opt, i) => opt.setAttribute('aria-selected', String(i === index)));
        const active = this.#options[index];
        ensureFallbackId(active, 'option');
        // Options are in light DOM; aria-activedescendant uses the ID via attribute — works cross-root.
        this.#triggerEl.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
        this.#refreshLog();
    }

    /** @param {number} index */
    #selectOption(index) {
        const option = this.#options[index];
        if (!option) return;
        this.#valueEl.textContent = option.textContent?.trim() ?? '';
        this.#setExpanded(false);
        this.#triggerEl.focus();
    }

    #onKeyDown = (/** @type {KeyboardEvent} */ event) => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.#open
                    ? this.#activateOption(Math.min(this.#activeIndex + 1, this.#options.length - 1))
                    : this.#setExpanded(true);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.#open
                    ? this.#activateOption(Math.max(this.#activeIndex - 1, 0))
                    : this.#setExpanded(true);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (!this.#open) {
                    this.#setExpanded(true);
                } else if (this.#activeIndex >= 0) {
                    this.#selectOption(this.#activeIndex);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.#setExpanded(false);
                break;
            case 'Home':
                if (this.#open) { event.preventDefault(); this.#activateOption(0); }
                break;
            case 'End':
                if (this.#open) { event.preventDefault(); this.#activateOption(this.#options.length - 1); }
                break;
        }
    };

    #onTriggerClick = (event) => {
        event.stopPropagation();
        this.#triggerEl.focus();
        this.#setExpanded(!this.#open);
    };

    #onOptionClick = (/** @type {MouseEvent} */ event) => {
        event.stopPropagation();
        const index = this.#options.indexOf(/** @type {HTMLElement} */ (event.currentTarget));
        if (index >= 0) this.#selectOption(index);
    };

    // Check the outer host (not the shadow trigger) so that clicks on slotted options
    // (which are in light DOM and appear in composedPath as children of this host) keep the
    // listbox open until #onOptionClick handles selection.
    #onDocumentClick = (event) => {
        if (this.#open && !event.composedPath().includes(this)) {
            this.#setExpanded(false);
        }
    };

    #buildLog() {
        const trigger = this.#triggerEl;
        if (!trigger) return '';

        const lines = [
            '<div role="combobox"> in shadow DOM — role is an HTML attribute on the shadow div',
            'ariaLabelledByElements, ariaDescribedByElements, ariaControlsElements set on the shadow trigger',
        ];

        if (SUPPORTS_ELEMENT_REFS) {
            lines.push(`trigger.ariaLabelledByElements → ${fmtEls(trigger.ariaLabelledByElements)}`);
            lines.push(`trigger.ariaDescribedByElements → ${fmtEls(trigger.ariaDescribedByElements)}`);
            lines.push(`trigger.ariaControlsElements → ${fmtEls(trigger.ariaControlsElements)}`);
        } else {
            lines.push(`trigger[aria-labelledby]="${trigger.getAttribute('aria-labelledby') ?? ''}" (fallback)`);
            lines.push(`trigger[aria-describedby]="${trigger.getAttribute('aria-describedby') ?? ''}" (fallback)`);
            lines.push(`trigger[aria-controls]="${trigger.getAttribute('aria-controls') ?? ''}" (fallback)`);
        }

        lines.push(`aria-expanded="${trigger.getAttribute('aria-expanded') ?? ''}"`);
        lines.push(`aria-activedescendant="${trigger.getAttribute('aria-activedescendant') ?? ''}"`);

        this.#labelElements.forEach((el, i) =>
            lines.push(`label[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );
        this.#descriptionElements.forEach((el, i) =>
            lines.push(`description[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
        );
        this.#options.forEach((el, i) =>
            lines.push(`option[${i}]: ${fmtEl(el)} ("${el.textContent?.trim()}")`)
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

customElements.define('combobox-shadow-role', ComboboxShadowRole);
