const SUPPORTS_ACTIVE_DESCENDANT_ELEMENT = 'ariaActiveDescendantElement' in Element.prototype;

class ComboboxReftarget extends HTMLElement {
    #triggerEl   = null;
    #listboxEl   = null;
    #valueEl     = null;
    #options     = [];
    #open        = false;
    #activeIndex = -1;

    constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }); }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
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
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>shadowRoot.referenceTarget</dt><dd id="db-rt"></dd>
                        <dt>aria-labelledby (host)</dt><dd id="db-lb"></dd>
                        <dt>aria-describedby (host)</dt><dd id="db-db"></dd>
                        <dt>aria-controls</dt><dd id="db-controls"></dd>
                        <dt>aria-expanded</dt><dd id="db-expanded"></dd>
                        <dt>Active descendant</dt><dd id="db-active"></dd>
                    </dl>
                </div>
            </div>
        `;
        this.shadowRoot.referenceTarget = 'role';
        this.#triggerEl = this.shadowRoot.querySelector('#role');
        this.#listboxEl = this.shadowRoot.querySelector('#listbox');
        this.#valueEl   = this.shadowRoot.querySelector('.combobox-value');

        const optionSlot = this.shadowRoot.querySelector('slot[name="options"]');
        optionSlot?.addEventListener('slotchange', () => {
            this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
            this.#options = optionSlot.assignedElements().filter(el => el.getAttribute('role') === 'option');
            this.#options.forEach(o => o.addEventListener('click', this.#onOptionClick));
            this.#updateDebug();
        });

        this.#triggerEl.addEventListener('keydown', this.#onKeyDown);
        this.#triggerEl.addEventListener('click',   this.#onTriggerClick);
        document.addEventListener('click', this.#onDocumentClick);

        this.#updateDebug();
    }

    disconnectedCallback() {
        this.#triggerEl?.removeEventListener('keydown', this.#onKeyDown);
        this.#triggerEl?.removeEventListener('click',   this.#onTriggerClick);
        document.removeEventListener('click', this.#onDocumentClick);
        this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
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
        this.#updateDebug();
    }

    #clearActive() {
        this.#options.forEach(o => o.classList.remove('is-active'));
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            this.#triggerEl.ariaActiveDescendantElement = null;
        } else {
            this.#triggerEl.removeAttribute('aria-activedescendant');
        }
        this.#updateDebug();
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

    #onTriggerClick  = event => { event.stopPropagation(); this.#triggerEl.focus(); this.#setExpanded(!this.#open); };
    #onOptionClick   = event => { event.stopPropagation(); const i = this.#options.indexOf(event.currentTarget); if (i >= 0) this.#selectOption(i); };
    #onDocumentClick = event => { if (this.#open && !event.composedPath().includes(this)) this.#setExpanded(false); };

    #updateDebug() {
        const set = (sel, val) => { const el = this.shadowRoot?.querySelector(sel); if (el) el.textContent = val ?? '(none)'; };
        const t = this.#triggerEl;
        set('#db-rt',       this.shadowRoot.referenceTarget ?? '(not set)');
        set('#db-lb',       this.getAttribute('aria-labelledby') ?? '(none)');
        set('#db-db',       this.getAttribute('aria-describedby') ?? '(none)');
        set('#db-controls', t?.getAttribute('aria-controls') ?? '');
        set('#db-expanded', t?.getAttribute('aria-expanded') ?? '');
        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            const active = t?.ariaActiveDescendantElement;
            set('#db-active', active
                ? `ariaActiveDescendantElement → "${active.textContent.trim()}"`
                : 'ariaActiveDescendantElement → null');
        } else {
            set('#db-active', `aria-activedescendant="${t?.getAttribute('aria-activedescendant') ?? ''}" (fallback)`);
        }
    }
}
customElements.define('combobox-reftarget', ComboboxReftarget);
