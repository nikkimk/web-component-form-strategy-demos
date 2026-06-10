const SUPPORTS_ACTIVE_DESCENDANT_ELEMENT = 'ariaActiveDescendantElement' in Element.prototype;

class ComboboxShadow extends HTMLElement {
    #triggerEl  = null;
    #listboxEl  = null;
    #labelEl    = null;
    #descEl     = null;
    #valueEl    = null;
    #options    = [];
    #open       = false;
    #activeIndex = -1;

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label">
                    <slot name="label">Label</slot>
                </span>
                <div
                    id="combobox"
                    class="combobox-trigger"
                    role="combobox"
                    tabindex="0"
                    aria-labelledby="label"
                    aria-describedby="description"
                    aria-controls="listbox"
                    aria-expanded="false"
                    aria-haspopup="listbox"
                    part="trigger"
                >
                    <span class="combobox-value" part="value">Select an option</span>
                    <span class="combobox-chevron" aria-hidden="true">&#9662;</span>
                </div>
                <ul
                    id="listbox"
                    class="combobox-listbox"
                    role="listbox"
                    part="listbox"
                    hidden
                >
                    <slot></slot>
                </ul>
                <span id="description" class="field-help">
                    <slot name="description">Description</slot>
                </span>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>aria-labelledby</dt><dd id="db-labelledby"></dd>
                        <dt>Label text</dt><dd id="db-label-text"></dd>
                        <dt>aria-describedby</dt><dd id="db-describedby"></dd>
                        <dt>Description text</dt><dd id="db-desc-text"></dd>
                        <dt>aria-controls</dt><dd id="db-controls"></dd>
                        <dt>aria-expanded</dt><dd id="db-expanded"></dd>
                        <dt>Active descendant</dt><dd id="db-active"></dd>
                    </dl>
                </div>
            </div>
        `;

        this.#triggerEl = this.shadowRoot.querySelector('#combobox');
        this.#listboxEl = this.shadowRoot.querySelector('#listbox');
        this.#labelEl   = this.shadowRoot.querySelector('#label');
        this.#descEl    = this.shadowRoot.querySelector('#description');
        this.#valueEl   = this.shadowRoot.querySelector('.combobox-value');

        const defaultSlot = this.shadowRoot.querySelector('slot:not([name])');
        defaultSlot?.addEventListener('slotchange', () => {
            this.#options.forEach(o => o.removeEventListener('click', this.#onOptionClick));
            this.#options = (defaultSlot.assignedElements()).filter(
                el => el.getAttribute('role') === 'option'
            );
            this.#options.forEach(o => o.addEventListener('click', this.#onOptionClick));
            this.#updateDebug();
        });

        this.shadowRoot.querySelectorAll('slot[name]').forEach(s =>
            s.addEventListener('slotchange', () => this.#updateDebug())
        );

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
        if (!open) {
            this.#activeIndex = -1;
            this.#clearActive();
        } else {
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
                this.#open && this.#activeIndex >= 0
                    ? this.#selectOption(this.#activeIndex)
                    : this.#setExpanded(!this.#open);
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

    #onTriggerClick = event => {
        event.stopPropagation();
        this.#triggerEl.focus();
        this.#setExpanded(!this.#open);
    };

    #onOptionClick = event => {
        event.stopPropagation();
        const index = this.#options.indexOf(event.currentTarget);
        if (index >= 0) this.#selectOption(index);
    };

    #onDocumentClick = event => {
        if (this.#open && !event.composedPath().includes(this)) {
            this.#setExpanded(false);
        }
    };

    #updateDebug() {
        const set = (sel, val) => {
            const el = this.shadowRoot.querySelector(sel);
            if (el) el.textContent = val;
        };
        const t = this.#triggerEl;
        set('#db-labelledby', t?.getAttribute('aria-labelledby') ?? '');
        set('#db-label-text', this.#labelEl?.textContent.trim() ?? '');
        set('#db-describedby', t?.getAttribute('aria-describedby') ?? '');
        set('#db-desc-text', this.#descEl?.textContent.trim() ?? '');
        set('#db-controls', t?.getAttribute('aria-controls') ?? '');
        set('#db-expanded', t?.getAttribute('aria-expanded') ?? '');

        if (SUPPORTS_ACTIVE_DESCENDANT_ELEMENT) {
            const active = t?.ariaActiveDescendantElement;
            set('#db-active', active
                ? `ariaActiveDescendantElement → ${active.tagName.toLowerCase()}${active.id ? '#' + active.id : ''} ("${active.textContent.trim()}")`
                : 'ariaActiveDescendantElement → null'
            );
        } else {
            set('#db-active', `aria-activedescendant="${t?.getAttribute('aria-activedescendant') ?? ''}" (fallback)`);
        }
    }
}

customElements.define('combobox-shadow', ComboboxShadow);
