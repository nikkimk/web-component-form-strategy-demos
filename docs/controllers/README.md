# ARIA ref controllers

Reusable controllers for wiring label and help text across Shadow DOM and Light DOM.

| Controller | Doc | Use when |
| ---------- | --- | -------- |
| **SplitSurfaceAriaController** | [split-surface-aria-controller.md](./split-surface-aria-controller.md) | Label/help split across host + `ElementInternals` (combobox, host-role PoC) |
| **SlottedFieldAriaController** | [slotted-field-aria-controller.md](./slotted-field-aria-controller.md) | Label/help slotted from the app author |
| **InnerCrossRootAriaController** | [inner-cross-root-aria-controller.md](./inner-cross-root-aria-controller.md) | Inner shadow input → page label (production textfield/checkbox) |

## Quick pick

```
Where does label/help live?
│
├─ Page (outside component) + inner native input
│  └─ InnerCrossRootAriaController
│
├─ Slotted from app author
│  └─ SlottedFieldAriaController
│
└─ Shadow and/or page (host owns focus / combobox)
   └─ SplitSurfaceAriaController
```

## Shared utilities

- [`aria-ref-utils.js`](../../aria-ref-utils.js) — partition light/shadow, assign IDs, mirror text
- [`field-ref-watchers.js`](../../field-ref-watchers.js) — `resolveLightFieldRefs`, slot watchers, `MutationObserver`

## Lifecycle pattern (all controllers)

```javascript
connectedCallback() {
    this.#ariaController = new SomeAriaController({ /* … */ });
    this.#ariaController.connect();
}

disconnectedCallback() {
    this.#ariaController?.disconnect();
}
```
