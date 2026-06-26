class CheckboxReftarget extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }); }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <div class="checkbox-native-surface">
                    <input id="role" type="checkbox" class="checkbox-input-native" part="input" />
                </div>
                <div class="debug" part="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">
                        <dt>shadowRoot.referenceTarget</dt><dd id="db-rt"></dd>
                        <dt>aria-labelledby (host)</dt><dd id="db-lb"></dd>
                        <dt>aria-describedby (host)</dt><dd id="db-db"></dd>
                    </dl>
                </div>
            </div>
        `;
        this.shadowRoot.referenceTarget = 'role';
        this.#updateDebug();
    }

    #updateDebug() {
        const set = (sel, val) => { const el = this.shadowRoot?.querySelector(sel); if (el) el.textContent = val ?? '(none)'; };
        set('#db-rt', this.shadowRoot.referenceTarget ?? '(not set)');
        set('#db-lb', this.getAttribute('aria-labelledby') ?? '(none)');
        set('#db-db', this.getAttribute('aria-describedby') ?? '(none)');
    }
}
customElements.define('checkbox-reftarget', CheckboxReftarget);
