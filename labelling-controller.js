const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}

export class LabellingController {
    #shadowRoot  = null;
    #roleEl      = null;
    #labelEl     = null;
    #descEl      = null;
    #labelledby  = '';
    #describedby = '';
    #onUpdate;

    constructor({ onUpdate } = {}) {
        this.#onUpdate = onUpdate;
    }

    /**
     * Call from connectedCallback after setting shadowRoot.innerHTML.
     * Expects #role, #label, #description elements and slot[name="label"],
     * slot[name="description"] in the shadow DOM.
     */
    connect(shadowRoot) {
        this.#shadowRoot = shadowRoot;
        this.#roleEl  = shadowRoot.querySelector('#role');
        this.#labelEl = shadowRoot.querySelector('#label');
        this.#descEl  = shadowRoot.querySelector('#description');

        shadowRoot.querySelectorAll('slot[name="label"], slot[name="description"]').forEach(s =>
            s.addEventListener('slotchange', () => this.#wireAria())
        );
        this.#wireAria();
    }

    get labelledby()  { return this.#labelledby; }
    get describedby() { return this.#describedby; }

    set labelledby(val) {
        this.#labelledby = val ?? '';
        this.#wireAria();
    }

    set describedby(val) {
        this.#describedby = val ?? '';
        this.#wireAria();
    }

    /** Current state snapshot for debug panels. */
    get debugInfo() {
        const hasLabel = this.#slotHasContent('label');
        const hasDesc  = this.#slotHasContent('description');
        const labelEls = hasLabel ? [this.#labelEl] : resolveIds(this.#labelledby);
        // Description combines shadow span + light siblings when both are present
        const descEls  = [
            ...(hasDesc ? [this.#descEl] : []),
            ...resolveIds(this.#describedby),
        ];
        return {
            mode:        hasLabel || hasDesc ? 'slotted' : 'light DOM siblings',
            labelledby:  this.#labelledby  || '(not set)',
            labelText:   labelEls.map(e => e.textContent.trim()).join(', '),
            describedby: this.#describedby || '(not set)',
            descText:    descEls.map(e => e.textContent.trim()).join(', '),
            api: SUPPORTS_ELEMENT_REFS
                ? (hasLabel
                    ? 'ariaLabelledByElements → shadow span'
                    : 'ariaLabelledByElements → light sibling')
                : (hasLabel
                    ? 'aria-labelledby (same-root)'
                    : 'aria-label / aria-description (fallback)'),
        };
    }

    #slotHasContent(name) {
        const slot = this.#shadowRoot?.querySelector(`slot[name="${name}"]`);
        return !!slot?.assignedNodes({ flatten: true }).some(n => n.textContent.trim());
    }

    #wireAria() {
        if (!this.#roleEl) return;
        const hasLabel = this.#slotHasContent('label');
        const hasDesc  = this.#slotHasContent('description');

        this.#labelEl.hidden = !hasLabel;
        this.#descEl.hidden  = !hasDesc;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#roleEl.ariaLabelledByElements = hasLabel
                ? [this.#labelEl]
                : resolveIds(this.#labelledby);

            // Always combine shadow desc span + any light DOM siblings
            this.#roleEl.ariaDescribedByElements = [
                ...(hasDesc ? [this.#descEl] : []),
                ...resolveIds(this.#describedby),
            ];
        } else {
            if (hasLabel) {
                this.#roleEl.setAttribute('aria-labelledby', 'label');
            } else {
                const text = resolveIds(this.#labelledby).map(e => e.textContent.trim()).join(' ');
                text ? this.#roleEl.setAttribute('aria-label', text)
                     : this.#roleEl.removeAttribute('aria-label');
                this.#roleEl.removeAttribute('aria-labelledby');
            }
            if (hasDesc) {
                // Same-root aria-describedby covers the shadow span.
                // Append light sibling text via aria-description as best-effort fallback.
                this.#roleEl.setAttribute('aria-describedby', 'description');
                const sibText = resolveIds(this.#describedby).map(e => e.textContent.trim()).join(' ');
                sibText ? this.#roleEl.setAttribute('aria-description', sibText)
                        : this.#roleEl.removeAttribute('aria-description');
            } else {
                const text = resolveIds(this.#describedby).map(e => e.textContent.trim()).join(' ');
                text ? this.#roleEl.setAttribute('aria-description', text)
                     : this.#roleEl.removeAttribute('aria-description');
                this.#roleEl.removeAttribute('aria-describedby');
            }
        }

        this.#onUpdate?.();
    }
}

/** Shadow DOM snippet for the labelling rows of a debug panel. */
export const LABELLING_DEBUG_HTML = `
    <dt>Mode</dt><dd id="db-mode"></dd>
    <dt>labelledby prop</dt><dd id="db-labelledby"></dd>
    <dt>Label text</dt><dd id="db-label-text"></dd>
    <dt>describedby prop</dt><dd id="db-describedby"></dd>
    <dt>Description text</dt><dd id="db-desc-text"></dd>
    <dt>Association API</dt><dd id="db-api"></dd>
`;

/** Write LabellingController.debugInfo into a component's shadow debug panel. */
export function applyLabellingDebug(shadowRoot, info) {
    const set = (sel, val) => { const el = shadowRoot.querySelector(sel); if (el) el.textContent = val; };
    set('#db-mode',        info.mode);
    set('#db-labelledby',  info.labelledby);
    set('#db-label-text',  info.labelText);
    set('#db-describedby', info.describedby);
    set('#db-desc-text',   info.descText);
    set('#db-api',         info.api);
}
