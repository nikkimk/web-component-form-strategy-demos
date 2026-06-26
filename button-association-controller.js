/**
 * ButtonAssociationController
 *
 * A shim for the proposed "Custom Elements with Button Activation Behaviors"
 * (https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ElementInternalsType/explainer.md).
 *
 * Browsers that implement the spec natively are detected via the presence of
 * `ElementInternals.prototype.commandForElement`; the controller no-ops in
 * those environments.
 *
 * The host element must:
 *   - declare  static buttonActivationBehaviors = true
 *   - call     new ButtonAssociationController(this, this.attachInternals())
 *   - delegate connectedCallback    → controller.connect()
 *   - delegate disconnectedCallback → controller.disconnect()
 *   - observe  ['commandfor', 'command', 'disabled'] and call
 *              controller.syncAttributes() from attributeChangedCallback
 *
 * The controller adds to the host:
 *   - tabindex="0"  (focusability)
 *   - role="button" via ElementInternals (overridable by author via `role` attr)
 *   - Enter / Space keyboard activation → synthesised click
 *   - click → CommandEvent on the commandfor target + built-in command execution
 *   - aria-disabled reflection
 */

// ── CommandEvent shim ────────────────────────────────────────────────────────

/**
 * Minimal shim for the CommandEvent interface proposed in the explainer.
 * Installed on globalThis only when the browser does not provide it natively.
 */
class _CommandEvent extends Event {
    #source;
    #command;

    constructor(type, init = {}) {
        super(type, { bubbles: false, cancelable: true, ...init });
        this.#source  = init.source  ?? null;
        this.#command = init.command ?? '';
    }

    get source()  { return this.#source; }
    get command() { return this.#command; }
}

if (!globalThis.CommandEvent) {
    globalThis.CommandEvent = _CommandEvent;
}

// ── Native support detection ─────────────────────────────────────────────────

// The spec adds commandForElement to ElementInternals; its presence means the
// browser handles activation behaviors natively.
const NATIVE_SUPPORT =
    typeof ElementInternals !== 'undefined' &&
    'commandForElement' in ElementInternals.prototype;

// ── Built-in command handlers ────────────────────────────────────────────────

const BUILT_IN_COMMANDS = new Map([
    ['show-popover',   el => el.showPopover?.()],
    ['hide-popover',   el => el.hidePopover?.()],
    ['toggle-popover', el => el.togglePopover?.()],
    ['show-modal',     el => el instanceof HTMLDialogElement && el.showModal()],
    ['close',          el => el instanceof HTMLDialogElement && el.close()],
    ['request-submit', el => el instanceof HTMLFormElement  && el.requestSubmit()],
    ['reset',          el => el instanceof HTMLFormElement  && el.reset()],
]);

// ── Controller ───────────────────────────────────────────────────────────────

export class ButtonAssociationController {
    #host;
    #internals;
    #observer;

    /**
     * @param {HTMLElement}    host       The custom element instance.
     * @param {ElementInternals} internals Result of host.attachInternals().
     */
    constructor(host, internals) {
        this.#host      = host;
        this.#internals = internals;
    }

    connect() {
        if (NATIVE_SUPPORT) return;

        const host = this.#host;

        // Focusability — only set tabindex when the author has not specified one.
        if (!host.hasAttribute('tabindex')) {
            host.setAttribute('tabindex', '0');
        }

        // ARIA role — respect explicit role attribute or ElementInternals.role set
        // by the author; fall back to 'button'.
        if (!host.hasAttribute('role') && !this.#internals.role) {
            this.#internals.role = 'button';
        }

        host.addEventListener('keydown', this.#handleKeydown);
        host.addEventListener('click',   this.#handleClick);

        // Watch commandfor / command / disabled without requiring the host to
        // list them in observedAttributes.
        this.#observer = new MutationObserver(() => this.#syncState());
        this.#observer.observe(host, {
            attributes: true,
            attributeFilter: ['commandfor', 'command', 'disabled'],
        });

        this.#syncState();
    }

    disconnect() {
        if (NATIVE_SUPPORT) return;
        this.#host.removeEventListener('keydown', this.#handleKeydown);
        this.#host.removeEventListener('click',   this.#handleClick);
        this.#observer?.disconnect();
        this.#observer = null;
    }

    // ── Reflected properties (mirror the spec's ElementInternals additions) ──

    /** The element referenced by the `commandfor` attribute, or null. */
    get commandForElement() {
        if (NATIVE_SUPPORT) return this.#internals.commandForElement;
        const id = this.#host.getAttribute('commandfor');
        return id ? (this.#host.getRootNode({ composed: true }).getElementById?.(id)
                     ?? document.getElementById(id)) : null;
    }

    /** The value of the `command` attribute. */
    get command() {
        if (NATIVE_SUPPORT) return this.#internals.command;
        return this.#host.getAttribute('command') ?? '';
    }

    // ── Private ──────────────────────────────────────────────────────────────

    #isDisabled() {
        return this.#host.hasAttribute('disabled') ||
               this.#host.closest('[inert]') !== null;
    }

    #handleKeydown = (e) => {
        if (this.#isDisabled()) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.#host.click();
        }
    };

    #handleClick = () => {
        if (this.#isDisabled()) return;

        const target  = this.commandForElement;
        const command = this.command;

        if (!target || !command) return;

        const event = new globalThis.CommandEvent('command', {
            source:  this.#host,
            command,
        });

        const notCancelled = target.dispatchEvent(event);

        // Execute built-in behavior only when not cancelled and command is known.
        if (notCancelled && BUILT_IN_COMMANDS.has(command)) {
            BUILT_IN_COMMANDS.get(command)(target);
        }
    };

    #syncState() {
        const host     = this.#host;
        const disabled = this.#isDisabled();

        // Reflect disabled state accessibly.
        host.setAttribute('aria-disabled', String(disabled));

        // Remove from tab order when disabled; restore when re-enabled.
        if (disabled) {
            host.setAttribute('tabindex', '-1');
        } else if (host.getAttribute('tabindex') === '-1') {
            host.setAttribute('tabindex', '0');
        }
    }
}

export { NATIVE_SUPPORT };
