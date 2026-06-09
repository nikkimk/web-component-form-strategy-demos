# Form fields strategy demos

Live examples that help the team decide **where ARIA roles go** and **how labels and help text connect** across Shadow DOM and Light DOM.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

> **Not in this repo:** form submit values (Q1) and axe test rules (Q4). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) for full context.

---

## TL;DR — two answers

| Question | Short answer |
| -------- | ------------ |
| **Q2 — Where do roles live?** | Use the **host**. |
| **Q3 — How do labels and help connect?** | Use **two wiring spots**. Light DOM targets → **host** (or inner input). Shadow DOM targets → **`ElementInternals`**. |

---

## Start here — which demo do I need?

| I want to… | Open this demo |
| ---------- | -------------- |
| Build a combobox with label inside the component | [Combobox — shadow label](./demo-combobox-shadow-label.html) |
| Build a combobox with label on the page | [Combobox — light label](./demo-combobox-light-label.html) |
| Mix page label + extra shadow label on one field | [Combobox — mixed label](./demo-combobox-mixed-label.html) |
| Build a textfield or checkbox with page label (cross-root wiring) | [Cross-root fields](./demo-cross-root-fields.html) |
| Let the app author pass in label markup (slots) | [Slotted label](./demo-host-slotted-label.html) |
| Change slotted label/help at runtime (errors, etc.) | [Dynamic slotted refs](./demo-host-slotted-dynamic.html) |
| Build a textfield or checkbox with host role + shadow labels | [Host shadow labels](./demo-host-shadow-label.html) ⭐ Q2 default |
| See the original cross-root CodePen idea on form fields | [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda) → [our demo](./demo-cross-root-fields.html) |

⭐ **Best starting point for textfields and checkboxes:** [Host shadow labels](./demo-host-shadow-label.html)

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
7. **Put the role on the host** (`ElementInternals` when shadow-internal wiring is needed). Use a native inner input for value and focus when the control needs one — not as a separate role surface.

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

### Cross-root label wiring (Q3 pattern)

| Demo | What it shows | Key takeaway |
| ---- | ------------- | ------------ |
| [Textfield, checkbox, progress bar](./demo-cross-root-fields.html) | Inner control in shadow; label/help on page | Wire refs on the **inner input** when the label is in light DOM and the control surface is in shadow. Same idea as the [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda). Role still lives on the **host** (Q2). |

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

### Host-role demos (Q2 default)

These put the widget role on the custom element host via `ElementInternals`.

| Demo | What it shows | Key takeaway |
| ---- | ------------- | ------------ |
| [All three — shadow labels](./demo-host-shadow-label.html) | Textfield, checkbox, progress bar | Same shadow-label wiring as combobox, on simpler fields. |
| [Slotted label](./demo-host-slotted-label.html) | Label passed in via slot | Slotted nodes stay in light tree → wire on **host**. |
| [Dynamic slotted](./demo-host-slotted-dynamic.html) | Swap label/help with buttons | Re-collect slots and update refs on every change. |
| [Light page labels](./demo-host-light-label.html) | External `<label>` on page | Host refs for label — compare to [cross-root demo](./demo-cross-root-fields.html). |
| [Textfield only](./demo-host-textfield-shadow.html) | Host acts as textbox | Inner input is decorative. |
| [Checkbox only](./demo-host-checkbox-shadow.html) | Host acts as checkbox | State on `internals.ariaChecked`. |
| [Progress bar only](./demo-host-progressbar-shadow.html) | Host carries progress role | Not in tab order; track is visual only. |

---

## Reusable controllers

Demos share three controllers. Each handles connect/disconnect, ID assignment, ref wiring, and re-sync when label/help changes.

**Full implementation guides:** [`docs/controllers/`](./docs/controllers/README.md)

| Controller | Guide | Use when |
| ---------- | ----- | -------- |
| **`SplitSurfaceAriaController`** | [doc](./docs/controllers/split-surface-aria-controller.md) | Label/help split across host + `ElementInternals` (combobox, host-role fields) |
| **`SlottedFieldAriaController`** | [doc](./docs/controllers/slotted-field-aria-controller.md) | Label/help slotted from the app author |
| **`InnerCrossRootAriaController`** | [doc](./docs/controllers/inner-cross-root-aria-controller.md) | Inner shadow input → page label/help (CodePen pattern) |

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
| Combobox / picker | Host (`ElementInternals`) | Host | [Combobox demos](./demo-combobox-shadow-label.html) |
| Textfield | Host (`ElementInternals`) | Host or inner input (`delegatesFocus`) | [Host shadow labels](./demo-host-shadow-label.html) · [Cross-root label wiring](./demo-cross-root-fields.html) |
| Checkbox | Host (`ElementInternals`) | Host or inner input | [Host shadow labels](./demo-host-shadow-label.html) · [Cross-root label wiring](./demo-cross-root-fields.html) |
| Progress bar | Host (`ElementInternals`) | Usually not focusable | [Progress demos](./demo-host-progressbar-shadow.html) |

> **Cross-root demos** wire page labels to a shadow inner input ([CodePen pattern](https://codepen.io/spectrum-css/pen/pvNEVda)). That is a **Q3 label-wiring** technique; Q2 still places the role on the host.

---

## How to wire label and help (Q3)

**Rule of thumb:** where the node lives decides where you wire it — not where the role lives. Q2 always places the role on the **host** via `ElementInternals`.

### Label and description by scenario

| Label / help scenario | Label | Description (help text) | Role (Q2 — same for all) | Re-sync when | Controller |
| --------------------- | ----- | ----------------------- | ------------------------ | ------------ | ---------- |
| **Light DOM** — label and help on the page, outside the component | `host.ariaLabelledByElements = [labelEl]` | `host.ariaDescribedByElements = [helpEl]` | `internals.role = 'textbox'` (etc.) | Page nodes added/removed or text changes | [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) |
| **Shadow DOM** — label and help owned inside the component | `internals.ariaLabelledByElements = [labelEl]` | `internals.ariaDescribedByElements = [helpEl]` | Same | Shadow label/help text changes | [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) |
| **Slotted** — label and help passed in by the app author (`slot="label"`, `slot="description"`) | `host.ariaLabelledByElements = […assigned slot nodes]` | `host.ariaDescribedByElements = […assigned slot nodes]` | Same | `slotchange`, slotted node text changes | [`SlottedFieldAriaController`](./docs/controllers/slotted-field-aria-controller.md) |
| **Mixed** — some label/help in light DOM, some in shadow (same component) | **Split by tree:** light → `host.ariaLabelledByElements`; shadow → `internals.ariaLabelledByElements` | **Split by tree:** light → `host.ariaDescribedByElements`; shadow → `internals.ariaDescribedByElements` | Same | Any label/help node in either tree changes | [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) |

### Required extras by scenario

| Scenario | Also do this | Do not do this |
| -------- | ------------ | -------------- |
| Light DOM | Give label/help stable **IDs** before setting element refs. Resolve page nodes via `getElementById`, attributes, or `resolveRefs`. | `host.ariaLabelledByElements` → shadow label nodes |
| Shadow DOM | **Mirror text:** copy label/help string to `internals.ariaLabel` and `internals.ariaDescription` (not refs alone). Use `<span class="field-label">`, not `<label>` — focus is on the host. | `host.ariaLabelledByElements` → shadow nodes |
| Slotted | Collect assigned nodes from named slots; treat them as light DOM (they stay in the light tree). | Assume slotted nodes are shadow-internal |
| Mixed | Pass **all** label nodes in one array; partition light vs shadow automatically. Mirror **shadow** text on `internals`. Screen reader gets both names (light refs + shadow refs/mirror). | Put everything on host or everything on internals |

### Combobox / picker add-on (any label scenario)

When the popup/listbox lives in shadow, add this regardless of where label/help live:

| Link | Property |
| ---- | -------- |
| Host → shadow listbox | `internals.ariaControlsElements = [listboxEl]` |
| Host → active option | `host.setAttribute('aria-activedescendant', optionId)` |
| Host popup hint | `host.setAttribute('aria-haspopup', 'listbox')` |

Never set `host.ariaControlsElements` to a shadow listbox — Chromium ignores it.

### Example — mixed light + shadow label/help

```javascript
// All nodes in one list — controller splits by tree root
this.#ariaController = new SplitSurfaceAriaController({
  host: this,
  internals: this.#internals,
  role: 'combobox',
  controls: [this.#listbox],
  labelElements: [pageLabelEl, shadowLabelEl],
  descriptionElements: [pageHelpEl, shadowHelpEl],
});
this.#ariaController.connect();
```

Result:

- `pageLabelEl`, `pageHelpEl` → **host** element refs
- `shadowLabelEl`, `shadowHelpEl` → **internals** element refs + mirrored strings
- `listboxEl` → **internals** `ariaControlsElements`
- role → **host** via `internals.role`

### Demos that match each scenario

| Scenario | Demo |
| -------- | ---- |
| Light DOM | [Combobox — light label](./demo-combobox-light-label.html) · [Host — light page labels](./demo-host-light-label.html) |
| Shadow DOM | [Combobox — shadow label](./demo-combobox-shadow-label.html) · [Host — shadow labels](./demo-host-shadow-label.html) |
| Slotted | [Slotted label](./demo-host-slotted-label.html) · [Dynamic slotted](./demo-host-slotted-dynamic.html) |
| Mixed | [Combobox — mixed label](./demo-combobox-mixed-label.html) |

**One-line summary:** Q2 is always the host; Q3 splits on **tree location** — light targets wire on `host`, shadow targets wire on `internals` (with text mirroring), and slotted content counts as light.

**Controllers:** [guides](./docs/controllers/README.md) · [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) · [`SlottedFieldAriaController`](./docs/controllers/slotted-field-aria-controller.md) · [`InnerCrossRootAriaController`](./docs/controllers/inner-cross-root-aria-controller.md)

---

## Label inside shadow? Pick one fix

Shadow labels **cannot** link from the host. Choose:

| Fix | Best when |
| --- | --------- |
| **`ElementInternals` + mirror text** | Component owns the label in shadow |
| **Slots** | App author supplies label markup |
| **Page-level label** | Label sits next to the field on the page |
| **Inner input refs** | Page label wired to shadow inner control ([cross-root demo](./demo-cross-root-fields.html)) |

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
| Textfield | Host / internals textbox | Shadow → internals; light → host ([demo](./demo-host-shadow-label.html)) |
| Checkbox | Host / internals checkbox | Same |
| Textfield / checkbox (cross-root label wiring) | Host role; labels on inner input | Inner input → light label ([demo](./demo-cross-root-fields.html)) |
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
