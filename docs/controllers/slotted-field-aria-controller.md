# SlottedFieldAriaController

Wire label and help text that the **app author slotted in** from Light DOM.

Slotted nodes stay in the light tree even though they appear inside the component. This controller:

1. Collects assigned nodes from named slots on `slotchange`.
2. Delegates wiring to [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) (host element refs).
3. Re-syncs when slot content or slotted text changes.

**Source:** [`slotted-field-aria-controller.js`](../../slotted-field-aria-controller.js)

**Live demos:**

- [All controls — slotted label](../../demo-slotted-label.html)

---

## When to use it

| Use this controller | Do not use it |
| ------------------- | ------------- |
| App author passes `<label slot="label">` / help markup | Label is component-owned in shadow → use [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) with shadow elements |
| Label/help may change at runtime (errors, i18n) | Page-level label outside component → use [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) with `resolveLightFieldRefs` |
| Combobox with slotted label/help | Pass `controls: [listbox]` to `SlottedFieldAriaController` |

---

## Prerequisites

1. Call `attachInternals()` in the constructor (role goes on `internals`).
2. Add named slots in shadow DOM for label and description.
3. Document slot names for consumers (`label`, `description`, etc.).

```javascript
constructor() {
    super();
    this.#internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });
}
```

---

## Shadow DOM template

```html
<div class="field-label-slot">
    <slot name="label"></slot>
</div>
<div class="field-help-slot">
    <slot name="description"></slot>
</div>
<!-- control markup -->
```

---

## Consumer markup

```html
<my-textfield>
    <label slot="label" for="my-field">Email address</label>
    <span slot="description">We never share your email.</span>
</my-textfield>
```

Slot names must match `labelSlot` and `helpSlot` in the controller config (defaults: `label`, `help-text`).

---

## Config options

| Option | Type | Default | Purpose |
| ------ | ---- | ------- | ------- |
| `host` | `HTMLElement` | required | The custom element |
| `internals` | `ElementInternals` | required | From `attachInternals()` |
| `role` | `string` | required | e.g. `'textbox'` |
| `labelSlot` | `string` | `'label'` | Name of the label slot |
| `helpSlot` | `string` | `'help-text'` | Name of the description/help slot |
| `focusable` | `boolean` | `true` | Set `tabindex="0"` on host |
| `onRefsChange` | `function` | — | Called with `{ labelElements, descriptionElements }` after each sync |
| `onSync` | `function` | — | Called after each sync |

---

## API

```javascript
const controller = new SlottedFieldAriaController({ /* config */ });

controller.connect();
controller.resync();
controller.getRefs();
controller.disconnect();
```

---

## Example — basic slotted textfield

```javascript
import { SlottedFieldAriaController } from './slotted-field-aria-controller.js';

class MySlottedTextfield extends HTMLElement {
    #internals;
    #ariaController;
    #labelElements = [];
    #descriptionElements = [];

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        const labelSlot = 'label';
        const descriptionSlot = 'description';

        this.shadowRoot.innerHTML = `
            <slot name="${labelSlot}"></slot>
            <slot name="${descriptionSlot}"></slot>
            <input type="text" tabindex="-1" aria-hidden="true" />
        `;

        this.#ariaController = new SlottedFieldAriaController({
            host: this,
            internals: this.#internals,
            role: 'textbox',
            labelSlot,
            helpSlot: descriptionSlot,
            onRefsChange: ({ labelElements, descriptionElements }) => {
                this.#labelElements = labelElements;
                this.#descriptionElements = descriptionElements;
            },
        });

        this.#ariaController.connect();
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
    }
}
```

---

## Example — custom slot names via attributes

Let consumers or the component define slot names at runtime.

```javascript
connectedCallback() {
    const labelSlot = this.getAttribute('label-slot') ?? 'label';
    const descriptionSlot = this.getAttribute('description-slot') ?? 'help-text';

    this.shadowRoot.innerHTML = `
        <slot name="${labelSlot}"></slot>
        <slot name="${descriptionSlot}"></slot>
        …
    `;

    this.#ariaController = new SlottedFieldAriaController({
        host: this,
        internals: this.#internals,
        role: 'textbox',
        labelSlot,
        helpSlot: descriptionSlot,
        onRefsChange: (refs) => { /* store refs for logging */ },
    });

    this.#ariaController.connect();
}
```

---

## Example — dynamic slot content (help + error)

When the app replaces slotted nodes, `slotchange` triggers a re-sync. IDs are assigned automatically if the author omits them.

```javascript
// App code — swap description slot content
function showError(field) {
    field.querySelector('[slot="description"]')?.remove();

    const error = document.createElement('span');
    error.slot = 'description';
    error.textContent = 'Email is required.';
    field.append(error);
    // SlottedFieldAriaController re-syncs via slotchange
}
```

Multiple description nodes are supported — pass them all through the description slot or append several slotted elements.

---

## What the controller does for you

1. Listens for `slotchange` on label and description slots.
2. Re-collects assigned elements with `assignedElements({ flatten: true })`.
3. Assigns IDs to slotted nodes when missing.
4. Sets `host.ariaLabelledByElements` and `host.ariaDescribedByElements`.
5. Watches slotted nodes for text changes via `MutationObserver`.

---

## Common mistakes

| Mistake | Fix |
| ------- | --- |
| Slot name mismatch between template and consumer | Match `labelSlot` / `helpSlot` to `<slot name="…">` |
| Expecting slotted shadow labels to use `internals` | Slotted nodes are light tree → host refs are correct |
| Not calling `disconnect()` | Clean up in `disconnectedCallback` |
| Putting the interactive control in a slot | Keep the native input in shadow; only label/help slot in |

---

## Related

- [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) — underlying split-surface wiring
- [`InnerCrossRootAriaController`](./inner-cross-root-aria-controller.md) — production inner-input pattern
- [Project README — reusable controllers](../../README.md#reusable-controllers)
