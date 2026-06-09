# SplitSurfaceAriaController

Wire label and help text when targets live in **both** Light DOM and Shadow DOM.

- **Light DOM** label/help → `host.ariaLabelledByElements` / `host.ariaDescribedByElements`
- **Shadow DOM** label/help → `internals.ariaLabelledByElements` / `internals.ariaDescribedByElements` + mirrored `internals.ariaLabel` / `ariaDescription`
- **Shadow listbox** (combobox only) → `internals.ariaControlsElements`

**Source:** [`split-surface-aria-controller.js`](../../split-surface-aria-controller.js)

**Live demos:**

- [All controls — light label](../../demo-light-label.html)
- [All controls — shadow label](../../demo-shadow-label.html)

---

## When to use it

| Use this controller | Do not use it |
| ------------------- | ------------- |
| Combobox or picker with label/help in shadow or light | Label/help supplied only through slots → use [`SlottedFieldAriaController`](./slotted-field-aria-controller.md) |
| Host-role fields (textfield, checkbox, progress bar) | |
| Any field that needs `internals` → shadow listbox link | |

---

## Prerequisites

1. Call `attachInternals()` in the component constructor.
2. Know where your label and help nodes live (shadow elements, page elements, or both).
3. For combobox: have a shadow `<ul role="listbox">` element ready to pass as `controls`.

```javascript
constructor() {
    super();
    this.#internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });
}
```

---

## Config options

| Option | Type | Default | Purpose |
| ------ | ---- | ------- | ------- |
| `host` | `HTMLElement` | required | The custom element |
| `internals` | `ElementInternals` | required | From `attachInternals()` |
| `role` | `string` | required | e.g. `'combobox'`, `'textbox'`, `'checkbox'`, `'progressbar'` |
| `labelElements` | `HTMLElement[]` | `[]` | Static label nodes (use this **or** `resolveRefs`) |
| `descriptionElements` | `HTMLElement[]` | `[]` | Static help/error nodes |
| `resolveRefs` | `function` | — | Return `{ labelElements, descriptionElements }` when refs change |
| `controls` | `HTMLElement[]` | `[]` | Shadow listbox for combobox → sets `internals.ariaControlsElements` |
| `focusable` | `boolean` | `true` | Set `tabindex="0"` on host. Use `false` for progress bar. |
| `onRefsChange` | `function` | — | Called after each sync with current ref arrays |
| `onSync` | `function` | — | Called after each sync (e.g. refresh debug log) |

---

## API

```javascript
const controller = new SplitSurfaceAriaController({ /* config */ });

controller.connect();    // wire refs + start watchers
controller.resync();   // re-wire manually if needed
controller.getRefs();  // { labelElements, descriptionElements }
controller.disconnect(); // remove watchers
```

Always call `disconnect()` in `disconnectedCallback`.

---

## Example 1 — combobox with shadow label and help

Label and help are `<span>` elements inside shadow DOM. Listbox is also in shadow.

```javascript
import { SplitSurfaceAriaController } from './split-surface-aria-controller.js';

class MyCombobox extends HTMLElement {
    #internals;
    #ariaController;

    constructor() {
        super();
        this.#internals = this.attachInternals();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <span class="field-label">Favorite fruit</span>
            <span class="field-help">Choose from the list.</span>
            <div class="trigger">Select…</div>
            <ul role="listbox" hidden><slot name="option"></slot></ul>
        `;

        const labelEl = this.shadowRoot.querySelector('.field-label');
        const helpEl = this.shadowRoot.querySelector('.field-help');
        const listbox = this.shadowRoot.querySelector('[role="listbox"]');

        this.#ariaController = new SplitSurfaceAriaController({
            host: this,
            internals: this.#internals,
            role: 'combobox',
            controls: [listbox],
            labelElements: [labelEl],
            descriptionElements: [helpEl],
        });

        this.#ariaController.connect();
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
    }
}
```

---

## Example 2 — combobox with page-level label and help

Label and help sit in Light DOM outside the component. Pass their elements (or IDs via `resolveRefs`).

```html
<label id="fruit-label" for="fruit-picker">Favorite fruit</label>
<my-combobox id="fruit-picker" label-target="fruit-label" help-target="fruit-help"></my-combobox>
<span id="fruit-help">Choose from the list.</span>
```

```javascript
connectedCallback() {
    // … render shadow trigger + listbox only …

    const labelEl = document.getElementById(this.getAttribute('label-target'));
    const helpEl = document.getElementById(this.getAttribute('help-target'));

    this.#ariaController = new SplitSurfaceAriaController({
        host: this,
        internals: this.#internals,
        role: 'combobox',
        controls: [this.#listbox],
        labelElements: [labelEl].filter(Boolean),
        descriptionElements: [helpEl].filter(Boolean),
    });

    this.#ariaController.connect();
}
```

---

## Example 3 — host-role textfield (PoC)

Shadow label/help only. Role lives on `internals`, not the inner input.

```javascript
this.#ariaController = new SplitSurfaceAriaController({
    host: this,
    internals: this.#internals,
    role: 'textbox',
    labelElements: [this.shadowRoot.querySelector('.field-label')],
    descriptionElements: [this.shadowRoot.querySelector('.field-help')],
});
this.#ariaController.connect();
```

---

## Example 4 — progress bar (not focusable)

```javascript
this.#ariaController = new SplitSurfaceAriaController({
    host: this,
    internals: this.#internals,
    role: 'progressbar',
    focusable: false,
    labelElements: [labelEl],
    descriptionElements: [helpEl],
});
this.#ariaController.connect();
```

Set value state separately on `internals.ariaValueNow`, `ariaValueText`, etc.

---

## What the controller does for you

1. Partitions label/help nodes into light vs shadow trees.
2. Assigns stable IDs to nodes that do not have one.
3. Sets element refs on the correct surface (host vs internals).
4. Copies shadow label text to `internals.ariaLabel` and `internals.ariaDescription`.
5. Watches label/help nodes for text changes and re-syncs.
6. Falls back to `aria-labelledby` / `aria-describedby` ID attributes when element refs are unavailable (light targets only).

---

## Common mistakes

| Mistake | Fix |
| ------- | --- |
| Setting `host.ariaControlsElements = [shadowListbox]` | Pass listbox in `controls` — only `internals` works |
| Using shadow `<label for="…">` when focus is on host | Use `<span class="field-label">` for shadow-resident labels |
| Forgetting `disconnect()` | Always disconnect in `disconnectedCallback` |
| Passing host as the only surface for shadow labels | Shadow labels must go through `internals` |

---

## Related

- [`SlottedFieldAriaController`](./slotted-field-aria-controller.md) — label/help from slots
- [`InnerCrossRootAriaController`](./inner-cross-root-aria-controller.md) — inner input → page label
- [Project README — reusable controllers](../../README.md#reusable-controllers)
