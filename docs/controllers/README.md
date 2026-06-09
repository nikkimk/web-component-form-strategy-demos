# ARIA ref controllers

Reusable controllers for wiring label and help text across Shadow DOM and Light DOM. All demos keep the role on the **host** via `ElementInternals`.

| Controller | Doc | Use when |
| ---------- | --- | -------- |
| **SplitSurfaceAriaController** | [split-surface-aria-controller.md](./split-surface-aria-controller.md) | Light, shadow, or mixed label/help on host-role fields and combobox |
| **SlottedFieldAriaController** | [slotted-field-aria-controller.md](./slotted-field-aria-controller.md) | Label/help slotted from the app author |

## Demo pages

Each page shows textfield, checkbox, progress bar, and combobox for one label scenario:

| Scenario | Demo |
| -------- | ---- |
| Light DOM label/help | [demo-light-label.html](../../demo-light-label.html) |
| Shadow DOM label/help | [demo-shadow-label.html](../../demo-shadow-label.html) |
| Slotted label/help | [demo-slotted-label.html](../../demo-slotted-label.html) |
| Mixed light + shadow | [demo-mixed-label.html](../../demo-mixed-label.html) |

## Quick pick

```
Where does label/help live?
│
├─ Slotted from app author
│  └─ SlottedFieldAriaController
│
└─ Page, shadow, or both (host owns role / combobox)
   └─ SplitSurfaceAriaController
```

## Shared utilities

- [`aria-ref-utils.js`](../../aria-ref-utils.js) — partition light/shadow, assign IDs, mirror text
- [`field-ref-watchers.js`](../../field-ref-watchers.js) — `resolveLightFieldRefs`, `resolveSplitSurfaceFieldRefs`, slot watchers, `MutationObserver`

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
