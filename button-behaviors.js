import { ButtonAssociationController, NATIVE_SUPPORT } from './button-association-controller.js';

/**
 * <button-behaviors>
 *
 * Demo component exercising ButtonAssociationController — a shim for the proposed
 * "Custom Elements with Button Activation Behaviors" spec.
 *
 * Attributes:
 *   commandfor   ID of the element to invoke (e.g. a <dialog> or <form>)
 *   command      Built-in command string (show-modal, close, toggle-popover, …)
 *   disabled     Boolean — removes from tab order, blocks activation
 *
 * The static `buttonActivationBehaviors = true` declaration is the opt-in
 * defined by the spec proposal; the controller reads it as documentation/intent
 * but behaviour is always provided by the shim in browsers lacking native support.
 */
class ButtonBehaviors extends HTMLElement {
    static buttonActivationBehaviors = true;

    #internals = this.attachInternals();
    #behaviors;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.#behaviors = new ButtonAssociationController(this, this.#internals);
    }

    static get observedAttributes() {
        return ['commandfor', 'command', 'disabled', 'variant'];
    }

    attributeChangedCallback() {
        this.#render();
    }

    connectedCallback() {
        this.#render();
        this.#behaviors.connect();
    }

    disconnectedCallback() {
        this.#behaviors.disconnect();
    }

    // ── Public API (mirrors ElementInternals additions from the spec) ─────────

    get commandForElement() { return this.#behaviors.commandForElement; }
    get command()           { return this.#behaviors.command; }

    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(val) { this.toggleAttribute('disabled', Boolean(val)); }

    // ── Private ───────────────────────────────────────────────────────────────

    #render() {
        const variant = this.getAttribute('variant') ?? 'primary';
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <style>
                :host { display: inline-block; }
                .btn { cursor: pointer; }
                :host([disabled]) .btn { opacity: 0.4; cursor: not-allowed; }
            </style>
            <span class="btn ${variant === 'secondary' ? 'btn--secondary' : ''}" part="button">
                <slot>Button</slot>
            </span>
        `;

        if (!NATIVE_SUPPORT) {
            const shimNote = document.createElement('span');
            shimNote.setAttribute('aria-hidden', 'true');
            shimNote.style.cssText = 'position:absolute;font-size:0.6em;top:0;right:0;background:var(--color-warning,#f5a623);padding:1px 3px;border-radius:2px;';
            shimNote.textContent = 'shim';
            this.shadowRoot.querySelector('[part="button"]').appendChild(shimNote);
        }
    }
}

customElements.define('button-behaviors', ButtonBehaviors);
