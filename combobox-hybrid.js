const SUPPORTS_ELEMENT_REFS = 'ariaLabelledByElements' in Element.prototype;

function resolveIds(ids) {
    return (ids ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)).filter(Boolean);
}
const SUPPORTS_ACTIVE_DESCENDANT_ELEMENT = 'ariaActiveDescendantElement' in Element.prototype;

class ComboboxHybrid extends HTMLElement {
    #triggerEl   = null;
    #listboxEl   = null;
    #labelEl     = null;
    #descEl      = null;
    #valueEl     = null;
    #options     = [];
    #open        = false;
    #activeIndex = -1;
    #labelledby  = '';
    #describedby = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() { return ['labelledby', 'describedby']; }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
    }

    get labelledby()  { return this.#labelledby; }
    get describedby() { return this.#describedby; }
    set labelledby(val)  { this.#labelledby  = val ?? ''; this.#wireAria(); }
    set describedby(val) { this.#describedby = val ?? ''; this.#wireAria(); }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden>
                    <slot name="label"></slot>
                </span>
                <div
                    id="role"
                    class="combobox-trigger"
                    role="combobox"
                    tabindex="0"
                    aria-controls="listbox"
                    aria-expanded="false"
                    aria-haspopup="listbox"
                    part="trigger"
                >
                    <span class="combobox-value" part="value">Select an option</span>
                    <span class="combobox-chevron" aria-hidden="true">&#9662;</span>
                </div>
                <ul id="listbox" class="combobox-listbox" role="listbox" part="listbox" hidden>
                    <slot name="options"></slot>
                </ul>
                <span id="description" class="field-help" hidden>
                    <slot name="description"></slot>
                </span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>Mode</dt><dd id="db-mode"></dd>
                        <dt>labelledby prop</dt><dd id="db-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>describedby prop</dt><dd id="db-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                        <dt>aria-controls</dt><dd id="db-controls"></dd>
                        <dt>aria-expanded</dt><dd id="db-expanded"></dd>
                        <dt>Active descendant</dt><dd id="db-active"></dd>
                        <dt>Association API</dt><dd id="db-api"></dd>
                    </dl>
                </div>
            </div>
        `;

        this.#triggerEl = this.shadowRoot.querySelector('#role');
        this.#listboxEl = this.shadowRoot.querySelector('#listbox');
        this.#labelEl   = this.shadowRoot.querySelector('#label');
        this.#descEl    = this.shadowRoot.querySelector('#description');
        this.#valueEl   = this.shadowRoot.querySelector('.combobox-value');

        const optionSlot = this.shadowRoot.querySelector('slot[name="options"]');
        optionSlot?.addEventListener('slotchange', () => {
            this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
            this.#options = optionSlot.assignedElements().filter(
                el => el.getAttribute('role') === 'option'
            );
            this.#options.forEach(o => o.addEventListener('click', this.#onOptionClick));
            this.#updateDebug(this.#slotHasContent('label'), this.#slotHasContent('description'));
        });

        this.shadowRoot.querySelectorAll('slot[name="label"], slot[name="description"]').forEach(s =>
            s.addEventListener('slotchange', () => this.#wireAria())
        );

        this.#triggerEl.addEventListener('keydown', this.#onKeyDown);
        this.#triggerEl.addEventListener('click',   this.#onTriggerClick);
        document.addEventListener('click', this.#onDocumentClick);
        this.#wireAria();
    }

    disconnectedCallback() {
        this.#triggerEl?.removeEventListener('keydown', this.#onKeyDown);
        this.#triggerEl?.removeEventListener('click',   this.#onTriggerClick);
        document.removeEventListener('click', this.#onDocumentClick);
        this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
    }

    #slotHasContent(name) {
        const slot = this.shadowRoot.querySelector(`slot[name="${name}"]`);
        return !!slot?.assignedNodes({ flatten: true }).some(n => n.textContent.trim());
    }

    #wireAria() {
        if (!this.#triggerEl) return;
        const hasLabel = this.#slotHasContent('label');
        const hasDesc  = this.#slotHasContent('description');
        this.#labelEl.hidden = !hasLabel;
        this.#descEl.hidden  = !hasDesc;

        if (SUPPORTS_ELEMENT_REFS) {
            this.#triggerEl.ariaLabelledByElements  = hasLabel ? [this.#labelEl] : resolveIds(this.#labelledby);
            this.#triggerEl.ariaDescribedByElements = hasDesc  ? [this.#descEl]  : resolveIds(this.#describedby);
        } else {
            if (hasLabel) {
                this.#triggerEl.setAttribute('aria-labelledby', 'label');
            } else {
                const text = resolveIds(this.#labelledby).map(e => e.textContent.trim()).join(' ');
                text ? this.#triggerEl.setAttribute('aria-label', text) : this.#triggerEl.removeAttribute('aria-label');
                this.#triggerEl.removeAttribute('aria-labelledby');
            }
            if (hasDesc) {
                this.#triggerEl.setAttribute('aria-describedby', 'description');
            } else {
                const text = resolveIds(this.#describedby).map(e => e.textContent.trim()).join(' ');
                text ? this.#triggerEl.setAttribute('aria-description', text) : this.#triggerEl.removeAttribute('aria-description');
                this.#triggerEl.removeAttribute('aria-describedby');
            }
        }
        this.#updateDebug(hasLabel, hasDesc);
    }

    #setExpanded(open) {
        this.#open = open;
        this.#triggerEl.setAttribute('aria-expanded', String(open));
        this.#listboxEl.hidden = !open;
        if (!open) { this.#activeIndex = -1; this.#clearActive(); }
        else {
            const sel = this.#options.findIndex(o => o.getAttribute('aria-selected') === 'true');
            this.#activateOption(sel >= 0 ? sel : 0);
        }
    }

    #activateOption(index) {
        if (index < 0 || index >= this.#options.length) return;
        this.#activeIndex = index;
        const active = this.#options[index];
        this.#options.forEach((o, i) => o.classList.toggle('is-active', i === index));
        active.scrollIntoView({ block: 'nearest' });
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            this.#triggerEl.ariaActiveDescendantElement = active;
        } else {
            if (!active.id) active.id = `cbx-opt-${crypto.randomUUID()}`;
            this.#triggerEl.setAttribute('aria-activedescendant', active.id);
        }
        this.#updateDebug(this.#slotHasContent('label'), this.#slotHasContent('description'));
    }

    #clearActive() {
        this.#options.forEach(o => o.classList.remove('is-active'));
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            this.#triggerEl.ariaActiveDescendantElement = null;
        } else {
            this.#triggerEl.removeAttribute('aria-activedescendant');
        }
        this.#updateDebug(this.#slotHasContent('label'), this.#slotHasContent('description'));
    }

    #selectOption(index) {
        const opt = this.#options[index];
        if (!opt) return;
        this.#options.forEach(o => o.setAttribute('aria-selected', 'false'));
        opt.setAttribute('aria-selected', 'true');
        this.#valueEl.textContent = opt.textContent.trim();
        this.#setExpanded(false);
        this.#triggerEl.focus();
    }

    #onKeyDown = event => {
        switch (event.key) {
            case 'ArrowDown': event.preventDefault();
                this.#open ? this.#activateOption(Math.min(this.#activeIndex + 1, this.#options.length - 1)) : this.#setExpanded(true); break;
            case 'ArrowUp': event.preventDefault();
                this.#open ? this.#activateOption(Math.max(this.#activeIndex - 1, 0)) : this.#setExpanded(true); break;
            case 'Enter': case ' ': event.preventDefault();
                this.#open && this.#activeIndex >= 0 ? this.#selectOption(this.#activeIndex) : this.#setExpanded(!this.#open); break;
            case 'Escape': event.preventDefault(); this.#setExpanded(false); break;
            case 'Home': if (this.#open) { event.preventDefault(); this.#activateOption(0); } break;
            case 'End':  if (this.#open) { event.preventDefault(); this.#activateOption(this.#options.length - 1); } break;
        }
    };

    #onTriggerClick = event => { event.stopPropagation(); this.#triggerEl.focus(); this.#setExpanded(!this.#open); };
    #onOptionClick  = event => { event.stopPropagation(); const i = this.#options.indexOf(event.currentTarget); if (i >= 0) this.#selectOption(i); };
    #onDocumentClick = event => { if (this.#open && !event.composedPath().includes(this)) this.#setExpanded(false); };

    #updateDebug(hasLabel, hasDesc) {
        const set = (sel, val) => { const el = this.shadowRoot.querySelector(sel); if (el) el.textContent = val; };
        const labelEls = hasLabel ? [this.#labelEl] : resolveIds(this.#labelledby);
        const descEls  = hasDesc  ? [this.#descEl]  : resolveIds(this.#describedby);
        const t = this.#triggerEl;
        set('#db-mode',        hasLabel || hasDesc ? 'slotted' : 'light DOM siblings');
        set('#db-labelledby',  this.#labelledby  || '(not set)');
        set('#db-label-text',  labelEls.map(e => e.textContent.trim()).join(', '));
        set('#db-describedby', this.#describedby || '(not set)');
        set('#db-desc-text',   descEls.map(e => e.textContent.trim()).join(', '));
        set('#db-controls', t?.getAttribute('aria-controls') ?? '');
        set('#db-expanded', t?.getAttribute('aria-expanded') ?? '');
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            const active = t?.ariaActiveDescendantElement;
            set('#db-active', active
                ? `ariaActiveDescendantElement \u2192 "${active.textContent.trim()}"`
                : 'ariaActiveDescendantElement \u2192 null');
        } else {
            set('#db-active', `aria-activedescendant="${t?.getAttribute('aria-activedescendant') ?? ''}" (fallback)`);
        }
        set('#db-api', SUPPORTS_ELEMENT_REFS
            ? (hasLabel || hasDesc ? 'ariaLabelledByElements \u2192 shadow span' : 'ariaLabelledByElements \u2192 light sibling')
            : (hasLabel || hasDesc ? 'aria-labelledby (same-root)' : 'aria-label / aria-description (fallback)'));
    }
}

customElements.define('combobox-hybrid', ComboboxHybrid);
