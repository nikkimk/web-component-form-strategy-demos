# InnerCrossRootAriaController

Wire a **shadow inner control** to **page-level** label and help in Light DOM.

Direction is **shadow → light only** (same as the [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda)):

```javascript
innerInput.ariaLabelledByElements = [pageLabel];
innerInput.ariaDescribedByElements = [pageHelp];
```

No `ElementInternals`. No host refs. No string `aria-labelledby` fallback across shadow.

**Source:** [`inner-cross-root-aria-controller.js`](../../inner-cross-root-aria-controller.js)

**Live demo:** [Cross-root fields — textfield, checkbox, progress bar](../../demo-cross-root-fields.html)

---

## When to use it

| Use this controller | Do not use it |
| ------------------- | ------------- |
| Production textfield or checkbox with native inner `<input>` | Label/help inside shadow → use [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) |
| Progress bar with inner `role="progressbar"` + page label | Label/help slotted from author → use [`SlottedFieldAriaController`](./slotted-field-aria-controller.md) |
| Tooltip/help in light DOM, button-like control in shadow | Host-role PoC with role on host |

---

## Prerequisites

1. Render the **interactive ARIA surface** inside shadow DOM (`<input>`, or `<div role="progressbar">`).
2. Put label and help in **Light DOM** on the page (siblings or nearby nodes with IDs).
3. Use `delegatesFocus: true` on the shadow root for textfield/checkbox so focus reaches the inner input.
4. Mark the inner surface with a selector (e.g. `data-aria-surface`) so the controller can find it.

```javascript
constructor() {
    super();
    this.attachShadow({ mode: 'open', delegatesFocus: true });
}
```

---

## Page markup pattern

```html
<label id="email-label" for="email-field">Email address</label>
<my-textfield id="email-field" label-target="email-label" help-target="email-help"></my-textfield>
<span id="email-help">We never share your email.</span>
```

The component reads targets by ID through `label-target` and `help-target` attributes (or your own `resolveRefs` logic).

---

## Config options

| Option | Type | Default | Purpose |
| ------ | ---- | ------- | ------- |
| `innerSurface` | `HTMLElement` | required | Inner input or `role="progressbar"` element in shadow |
| `resolveRefs` | `function` | required | Return `{ labelElements, descriptionElements }` from page |
| `onRefsChange` | `function` | — | Called after each sync |
| `onSync` | `function` | — | Called after each sync |

---

## API

```javascript
const controller = new InnerCrossRootAriaController({ /* config */ });

controller.connect();
controller.resync();
controller.getRefs();
controller.disconnect();
```

---

## Example 1 — textfield with page label and help

```javascript
import { InnerCrossRootAriaController } from './inner-cross-root-aria-controller.js';
import { resolveLightFieldRefs } from './field-ref-watchers.js';

class MyTextfield extends HTMLElement {
    #ariaController;
    #innerInput;

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <input type="text" data-aria-surface />
        `;

        this.#innerInput = this.shadowRoot.querySelector('[data-aria-surface]');

        this.#ariaController = new InnerCrossRootAriaController({
            innerSurface: this.#innerInput,
            resolveRefs: () =>
                resolveLightFieldRefs(this, {
                    labelTarget: this.getAttribute('label-target') ?? '',
                    helpTarget: this.getAttribute('help-target') ?? '',
                }),
        });

        this.#ariaController.connect();
    }

    disconnectedCallback() {
        this.#ariaController?.disconnect();
    }
}
```

---

## Example 2 — checkbox

Same pattern. The inner surface is `<input type="checkbox">`.

```javascript
this.shadowRoot.innerHTML = `
    <label class="checkbox-surface">
        <input type="checkbox" data-aria-surface />
        <span aria-hidden="true">✓</span>
    </label>
`;

this.#innerInput = this.shadowRoot.querySelector('[data-aria-surface]');

this.#ariaController = new InnerCrossRootAriaController({
    innerSurface: this.#innerInput,
    resolveRefs: () =>
        resolveLightFieldRefs(this, {
            labelTarget: this.getAttribute('label-target') ?? '',
            helpTarget: this.getAttribute('help-target') ?? '',
        }),
});

this.#ariaController.connect();
```

---

## Example 3 — progress bar

Inner surface is a `role="progressbar"` element. Set value attributes on that element separately.

```javascript
this.shadowRoot.innerHTML = `
    <div role="progressbar" data-aria-surface tabindex="-1" aria-valuemin="0">
        <div class="track" aria-hidden="true"><div class="fill"></div></div>
    </div>
`;

this.#innerSurface = this.shadowRoot.querySelector('[data-aria-surface]');

this.#ariaController = new InnerCrossRootAriaController({
    innerSurface: this.#innerSurface,
    resolveRefs: () =>
        resolveLightFieldRefs(this, {
            labelTarget: this.getAttribute('label-target') ?? '',
            helpTarget: this.getAttribute('help-target') ?? '',
        }),
});

this.#ariaController.connect();

// Update value on the inner surface, not the host:
this.#innerSurface.setAttribute('aria-valuenow', '40');
this.#innerSurface.setAttribute('aria-valuetext', '40 percent complete');
```

---

## Example 4 — custom resolveRefs (no label-target attributes)

```javascript
this.#ariaController = new InnerCrossRootAriaController({
    innerSurface: this.#innerInput,
    resolveRefs: () => ({
        labelElements: [this.previousElementSibling].filter(
            (el) => el?.matches('label')
        ),
        descriptionElements: [this.nextElementSibling].filter(
            (el) => el?.hasAttribute('data-help')
        ),
    }),
    onRefsChange: ({ labelElements, descriptionElements }) => {
        this.#labelElements = labelElements;
        this.#descriptionElements = descriptionElements;
    },
});

this.#ariaController.connect();
```

---

## Example 5 — manual one-shot wire (without lifecycle)

For simple cases you can wire once without the controller, but you lose automatic re-sync:

```javascript
const input = host.shadowRoot.querySelector('[data-aria-surface]');
const label = document.getElementById('email-label');
const help = document.getElementById('email-help');

input.ariaLabelledByElements = [label];
input.ariaDescribedByElements = [help];
```

Prefer the controller when label/help text can change.

---

## What the controller does for you

1. Resolves light DOM label/help nodes via your `resolveRefs` callback.
2. Sets `innerSurface.ariaLabelledByElements` and `ariaDescribedByElements`.
3. Watches label/help nodes for text changes and re-syncs.
4. Skips wiring gracefully when element refs are not supported (no safe fallback exists).

---

## Browser and AT notes

- Element refs do **not** write `aria-labelledby` / `aria-describedby` string attributes to the DOM.
- Direction **light → shadow** does not work — label must stay in Light DOM.
- Validated in Chrome/Edge 135+, Firefox 136+, Safari 16.4+ (see [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda)).

---

## Common mistakes

| Mistake | Fix |
| ------- | --- |
| Setting refs on the **host** instead of inner input | Wire the element that owns focus / native semantics |
| Putting label inside shadow and using this controller | Use [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) instead |
| Expecting ID string fallback when element refs missing | No cross-root fallback — require element ref support |
| Forgetting `delegatesFocus` on textfield/checkbox | Focus must reach the inner input |

---

## Related

- [`SplitSurfaceAriaController`](./split-surface-aria-controller.md) — shadow label via internals
- [`SlottedFieldAriaController`](./slotted-field-aria-controller.md) — slotted label/help
- [Project README — reusable controllers](../../README.md#reusable-controllers)
