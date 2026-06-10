class ButtonForm extends HTMLElement {
    static formAssociated = true;

    #internals = this.attachInternals();

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() { return ['type', 'disabled']; }

    attributeChangedCallback() { this.#sync(); }

    get type()     { return this.getAttribute('type') ?? 'submit'; }
    set type(val)  { this.setAttribute('type', val ?? 'submit'); }

    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(val) { this.toggleAttribute('disabled', Boolean(val)); }

    get form() { return this.#internals.form; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <button id="role" type="button" class="btn" part="button">
                <slot>Button</slot>
            </button>
        `;
        this.shadowRoot.querySelector('#role').addEventListener('click', () => {
            if (this.disabled) return;
            if (this.type === 'submit') this.#internals.form?.requestSubmit();
            if (this.type === 'reset')  this.#internals.form?.reset();
        });
        this.#sync();
    }

    #sync() {
        const btn = this.shadowRoot?.querySelector('#role');
        if (!btn) return;
        btn.disabled = this.disabled;
        // Reflect visual variant via data attribute so CSS can style it
        btn.dataset.variant = this.type === 'reset' ? 'secondary' : 'primary';
    }
}

customElements.define('button-form', ButtonForm);
