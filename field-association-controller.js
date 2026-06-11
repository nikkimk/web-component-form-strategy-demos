/**
 * FieldAssociationController
 *
 * Encapsulates the ElementInternals API surface shared by all form-associated
 * field components (textfield, checkbox, combobox, …).
 *
 * The host element must:
 *   - declare  static formAssociated = true
 *   - call     this.#fieldAssoc.setValue()  whenever its value changes
 *   - delegate formResetCallback() to restore the field using defaultValue
 *
 * The host cannot delegate attachInternals() or static formAssociated —
 * those must stay on the element class itself.
 */
export class FieldAssociationController {
    #internals;
    #defaultValue;

    /**
     * @param {ElementInternals} internals     Result of attachInternals() on the host.
     * @param {object}           [options]
     * @param {string|null}      [options.defaultValue='']
     */
    constructor(internals, { defaultValue = '' } = {}) {
        this.#internals    = internals;
        this.#defaultValue = defaultValue ?? '';
    }

    // ── Default value ────────────────────────────────────────────────────────
    get defaultValue()    { return this.#defaultValue; }
    set defaultValue(val) { this.#defaultValue = val ?? ''; }

    // ── Form value ───────────────────────────────────────────────────────────
    /**
     * Set the current form value. Pass null to exclude from FormData —
     * used for unchecked checkboxes, disabled fields, and unselected pickers.
     */
    setValue(val) { this.#internals.setFormValue(val); }

    // ── Form introspection (pass-throughs) ───────────────────────────────────
    get form()              { return this.#internals.form; }
    get validity()          { return this.#internals.validity; }
    get validationMessage() { return this.#internals.validationMessage; }
    get willValidate()      { return this.#internals.willValidate; }
    checkValidity()         { return this.#internals.checkValidity(); }
    reportValidity()        { return this.#internals.reportValidity(); }
}
