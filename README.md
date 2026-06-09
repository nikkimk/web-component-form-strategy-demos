# Form fields strategy demos

Live examples that help the team decide **where ARIA roles go** and **how labels and help text connect** across Shadow DOM and Light DOM.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

> **Not in this repo:** form submit values (Q1) and axe test rules (Q4). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) for full context.

---

## TL;DR — two answers

| Question | Short answer |
| -------- | ------------ |
| **Q2 — Where do roles live?** | Depends on the control. Comboboxes and pickers use the **host**. Textfields and checkboxes use a **native inner input**. |
| **Q3 — How do labels and help connect?** | Use **two wiring spots**. Light DOM targets → **host** (or inner input). Shadow DOM targets → **`ElementInternals`**. |

---

## Start here — which demo do I need?

| I want to… | Open this demo |
| ---------- | -------------- |
| Build a combobox with label inside the component | [Combobox — shadow label](./demo-combobox-shadow-label.html) |
| Build a combobox with label on the page | [Combobox — light label](./demo-combobox-light-label.html) |
| Mix page label + extra shadow label on one field | [Combobox — mixed label](./demo-combobox-mixed-label.html) |
| Build a **real** textfield or checkbox with page label | [Cross-root fields](./demo-cross-root-fields.html) ⭐ production pattern |
| Let the app author pass in label markup (slots) | [Slotted label](./demo-host-slotted-label.html) |
| Change slotted label/help at runtime (errors, etc.) | [Dynamic slotted refs](./demo-host-slotted-dynamic.html) |
| Experiment with role on the custom element host | [Host shadow labels](./demo-host-shadow-label.html) |
| See the original cross-root CodePen idea on form fields | [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda) → [our demo](./demo-cross-root-fields.html) |

⭐ **Best starting point for textfields and checkboxes:** [Cross-root fields](./demo-cross-root-fields.html)

---

## The big idea (plain language)

Web components split markup into two trees:

- **Light DOM** — nodes on the page (outside the component’s shadow root).
- **Shadow DOM** — nodes hidden inside the component.

Screen readers need to know which label and help text belong to which control. **You cannot wire everything from one place.** Where the label lives decides where you wire it.

### Two wiring spots

| Label or help lives in… | Wire it on… |
| ----------------------- | ----------- |
| Light DOM (page, or slotted) | **Host** or **inner input** |
| Shadow DOM (inside component) | **`ElementInternals`** |
| Shadow listbox / popup | **`ElementInternals`** only |
| List options (for combobox) | Light DOM + `aria-activedescendant` on host |

### What works vs what does not

| ✅ Works | ❌ Does not work |
| -------- | ---------------- |
| Shadow **inner input** → Light DOM label ([CodePen pattern](https://codepen.io/spectrum-css/pen/pvNEVda)) | Light DOM → Shadow label |
| Host → Light DOM label | Host → Shadow label |
| `internals` → Shadow label / listbox | `host.ariaControlsElements` → shadow listbox (Chrome ignores it) |
| Slotted label (stays in light tree) → host | String `aria-labelledby` from shadow to light |

---

## Seven rules (memorize these)

1. **Match the tree.** Light targets use host or inner input. Shadow targets use `ElementInternals`.
2. **Call `attachInternals()`** in the constructor when wiring shadow-internal links.
3. **Combobox listbox** lives in shadow; **options** live in light DOM and slot in.
4. **Copy shadow label text** to `internals.ariaLabel` and `internals.ariaDescription` — not just element refs.
5. **Give nodes IDs** before setting element refs.
6. **Re-wire when content changes** — use `slotchange` or `MutationObserver`.
7. **Production textfields/checkboxes:** use a **native inner input**, not role on the host.

---

## All demos

Each page has a **Resolved ARIA references** panel you can read while testing.

### Combobox

| Demo | What it shows | Key takeaway |
| ---- | ------------- | ------------ |
| [Shadow label/help](./demo-combobox-shadow-label.html) | Label, help, and listbox inside shadow | Shadow pieces wire through **`ElementInternals`**. Options still slot from light DOM. |
| [Light label/help](./demo-combobox-light-label.html) | Label and help on the page | Page label wires through the **host**. Listbox split is the same. |
| [Mixed label/help](./demo-combobox-mixed-label.html) | Page label + extra shadow label | **Split both ways** — light → host, shadow → internals. Best picture of the full model. |

**Combobox extras**

- Focus stays on the **host** (one tab stop).
- Listbox link: `internals.ariaControlsElements = [listbox]` — never on the host.
- Active option: `aria-activedescendant="option-id"` on the host.

---

### Cross-root inner surface ⭐ production pattern

| Demo | What it shows | Key takeaway |
| ---- | ------------- | ------------ |
| [Textfield, checkbox, progress bar](./demo-cross-root-fields.html) | Inner control in shadow; label/help on page | Set refs on the **inner input**, not the host. Same idea as the [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda). |

```javascript
const input = host.shadowRoot.querySelector('[data-aria-surface]');
input.ariaLabelledByElements = [document.getElementById('email-label')];
input.ariaDescribedByElements = [document.getElementById('email-help')];
```

- **Textfield / checkbox:** native `<input>` inside shadow.
- **Progress bar:** `<div role="progressbar">` inside shadow.
- **No fallback** if element refs are missing — string IDs cannot cross shadow.

Helper: [`InnerCrossRootAriaController`](./inner-cross-root-aria-controller.js)

---

### Host-role demos (experiments — not production default)

These put the widget role on the custom element host. Use them to **learn** the split-surface model, not to ship simple textfields.

| Demo | What it shows | Key takeaway |
| ---- | ------------- | ------------ |
| [All three — shadow labels](./demo-host-shadow-label.html) | Textfield, checkbox, progress bar | Same shadow-label wiring as combobox, on simpler fields. |
| [Slotted label](./demo-host-slotted-label.html) | Label passed in via slot | Slotted nodes stay in light tree → wire on **host**. |
| [Dynamic slotted](./demo-host-slotted-dynamic.html) | Swap label/help with buttons | Re-collect slots and update refs on every change. |
| [Light page labels](./demo-host-light-label.html) | External `<label>` on page | Host refs for label — compare to [cross-root demo](./demo-cross-root-fields.html). |
| [Textfield only](./demo-host-textfield-shadow.html) | Host acts as textbox | Inner input is decorative. PoC only. |
| [Checkbox only](./demo-host-checkbox-shadow.html) | Host acts as checkbox | State on `internals.ariaChecked`. |
| [Progress bar only](./demo-host-progressbar-shadow.html) | Host carries progress role | Not in tab order; track is visual only. |

---

## Reusable controllers

Demos share three controllers. Each handles connect/disconnect, ID assignment, ref wiring, and re-sync when label/help changes.

| Controller | Use when | Module |
| ---------- | -------- | ------ |
| **`SplitSurfaceAriaController`** | Label/help split across host + `ElementInternals` (combobox, host-role fields) | [`split-surface-aria-controller.js`](./split-surface-aria-controller.js) |
| **`SlottedFieldAriaController`** | Label/help slotted from the app author | [`slotted-field-aria-controller.js`](./slotted-field-aria-controller.js) |
| **`InnerCrossRootAriaController`** | Inner shadow input → page label/help (CodePen pattern) | [`inner-cross-root-aria-controller.js`](./inner-cross-root-aria-controller.js) |

Shared utilities: [`aria-ref-utils.js`](./aria-ref-utils.js) · [`field-ref-watchers.js`](./field-ref-watchers.js)

### Example — combobox (split surface + listbox)

```javascript
import { SplitSurfaceAriaController } from './split-surface-aria-controller.js';

this.#ariaController = new SplitSurfaceAriaController({
  host: this,
  internals: this.#internals,
  role: 'combobox',
  controls: [this.#listbox],
  labelElements: [shadowLabelEl],
  descriptionElements: [shadowHelpEl],
  onSync: () => this.#refreshLog(),
});
this.#ariaController.connect();
// disconnectedCallback: this.#ariaController.disconnect();
```

### Example — slotted label

```javascript
import { SlottedFieldAriaController } from './slotted-field-aria-controller.js';

this.#ariaController = new SlottedFieldAriaController({
  host: this,
  internals: this.#internals,
  role: 'textbox',
  labelSlot: 'label',
  helpSlot: 'description',
  onRefsChange: ({ labelElements, descriptionElements }) => { /* update log */ },
});
this.#ariaController.connect();
```

### Example — production textfield (inner input → page label)

```javascript
import { InnerCrossRootAriaController } from './inner-cross-root-aria-controller.js';

this.#ariaController = new InnerCrossRootAriaController({
  innerSurface: this.shadowRoot.querySelector('[data-aria-surface]'),
  resolveRefs: () => resolveLightFieldRefs(this, { labelTarget, helpTarget }),
});
this.#ariaController.connect();
```

Legacy function wrappers (`syncHostFieldAriaRefs`, `establishSlottedFieldAriaSync`, etc.) still exist but are deprecated — prefer the controllers above.

---

## Where to put the role (Q2)

| Control | Where role lives | Where focus goes | Demo |
| ------- | ---------------- | ---------------- | ---- |
| Combobox / picker | `ElementInternals` (or host fallback) | Host | [Combobox demos](./demo-combobox-shadow-label.html) |
| Textfield (ship this) | Native inner `<input>` | Inner input (`delegatesFocus`) | [Cross-root demo](./demo-cross-root-fields.html) |
| Checkbox (ship this) | Native inner `<input type="checkbox">` | Inner input | [Cross-root demo](./demo-cross-root-fields.html) |
| Progress bar | `ElementInternals` or inner `role="progressbar"` | Usually not focusable | [Progress demos](./demo-host-progressbar-shadow.html) |
| Host-role textfield/checkbox | `ElementInternals` | Host | Host-role demos above |

---

| Control | Where role lives | Where focus goes | Demo |
| ------- | ---------------- | ---------------- | ---- |
| Combobox / picker | `ElementInternals` (or host fallback) | Host | [Combobox demos](./demo-combobox-shadow-label.html) |
| Textfield (ship this) | Native inner `<input>` | Inner input (`delegatesFocus`) | [Cross-root demo](./demo-cross-root-fields.html) |
| Checkbox (ship this) | Native inner `<input type="checkbox">` | Inner input | [Cross-root demo](./demo-cross-root-fields.html) |
| Progress bar | `ElementInternals` or inner `role="progressbar"` | Usually not focusable | [Progress demos](./demo-host-progressbar-shadow.html) |
| Host-role textfield/checkbox | `ElementInternals` | Host | Host-role demos above |

---

## How to wire label and help (Q3)

| Label/help location | What to set |
| ------------------- | ----------- |
| On the page (light DOM) | `host.ariaLabelledByElements` or `inner.ariaLabelledByElements` |
| Slotted from app author | `host.ariaLabelledByElements` (re-sync on `slotchange`) |
| Inside shadow (component-owned) | `internals.ariaLabelledByElements` + mirror text on `internals.ariaLabel` |
| Shadow listbox | `internals.ariaControlsElements` |
| Slotted options | Host `aria-activedescendant="id"` |

**Controllers:** [`SplitSurfaceAriaController`](./split-surface-aria-controller.js) · [`SlottedFieldAriaController`](./slotted-field-aria-controller.js) · [`InnerCrossRootAriaController`](./inner-cross-root-aria-controller.js)

---

## Label inside shadow? Pick one fix

Shadow labels **cannot** link from the host. Choose:

| Fix | Best when |
| --- | --------- |
| **`ElementInternals` + mirror text** | Component owns the label in shadow |
| **Slots** | App author supplies label markup |
| **Page-level label** | Label sits next to the field on the page |
| **Inner input refs** | Production textfield/checkbox with page label |

---

## Bugs we hit building these demos

| Problem | Cause | Fix |
| ------- | ----- | --- |
| Shadow label silent in screen reader | Wired on host instead of internals | Use `internals` refs + mirror `ariaLabel` |
| Empty log panel | Wrong element selected | Query `.log[data-aria-log="…"]` only |
| Log empty on first load | Log `<pre>` not in DOM yet | `queueMicrotask()` refresh |
| Refs read as empty `[]` | Missing IDs on targets | Assign IDs before wiring |
| Shadow `<label>` broken | Focus is on host, not inside shadow | Use `<span class="field-label">` |
| Listbox not linked | Set `ariaControlsElements` on host | Set on **`internals`** |

---

## Cheat sheet — component → pattern

| Component | Role | Label / help / popup |
| --------- | ---- | -------------------- |
| Combobox | Internals combobox | Internals → shadow listbox; split label/help; light options |
| Textfield (production) | Inner native input | Inner input → light label ([demo](./demo-cross-root-fields.html)) |
| Checkbox (production) | Inner native input | Same |
| Textfield (host PoC) | Internals textbox | Shadow → internals; light → host |
| Progress bar | Internals progressbar | Shadow → internals + mirror |

---

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:8080/index.html](http://localhost:8080/index.html).

---

## References

- [Cross-root CodePen (original POC)](https://codepen.io/spectrum-css/pen/pvNEVda)
- [ElementInternals.ariaControlsElements (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements)
- [Reflected element references (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
- [Semantic HTML and ARIA guide (SWC)](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/guides/accessibility-guides/semantic_html_aria.mdx)
- [Focus management strategy RFC (SWC)](https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/03_project-planning/05_strategies/focus-management-strategy-rfc.md)
