# Form fields strategy demos

Live examples that help the team decide **where ARIA roles go** and **how labels and help text connect** across Shadow DOM and Light DOM.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

> **Not in this repo:** form submit values (Q1) and axe test rules (Q4). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) for full context.

---

## TL;DR — two answers

| Question | Short answer |
| -------- | ------------ |
| **Q2 — Where do roles live?** | Use the **host**. |
| **Q3 — How do labels and help connect?** | Use **two wiring spots**. Light DOM targets → **host**. Shadow DOM targets → **`ElementInternals`**. |

---

## Start here — which demo do I need?

Each demo page shows a **textfield**, **checkbox**, **progress bar**, and **combobox** using the same label wiring pattern. Role is always on the **host**.

| Label / help scenario | Demo page |
| --------------------- | --------- |
| Light DOM — label and help on the page | [All four controls — light label](./demo-light-label.html) |
| Shadow DOM — label and help inside the component | [All four controls — shadow label](./demo-shadow-label.html) |
| Slotted — label and help passed in by the app author | [All four controls — slotted label](./demo-slotted-label.html) |

### Demo matrix

| Control | [Light](./demo-light-label.html) | [Shadow](./demo-shadow-label.html) | [Slotted](./demo-slotted-label.html) |
| ------- | -------------------------------- | ---------------------------------- | ------------------------------------ |
| Textfield | ✓ | ✓ | ✓ |
| Checkbox | ✓ | ✓ | ✓ |
| Progress bar | ✓ | ✓ | ✓ |
| Combobox | ✓ | ✓ | ✓ |

---

## The big idea (plain language)

Web components split markup into two trees:

- **Light DOM** — nodes on the page (outside the component’s shadow root).
- **Shadow DOM** — nodes hidden inside the component.

Screen readers need to know which label and help text belong to which control. **You cannot wire everything from one place.** Where the label lives decides where you wire it.

### Two wiring spots

| Label or help lives in… | Wire it on… |
| ----------------------- | ----------- |
| Light DOM (page, or slotted) | **Host** |
| Shadow DOM (inside component) | **`ElementInternals`** |
| Shadow listbox / popup | **`ElementInternals`** only |
| List options (for combobox) | Light DOM + `aria-activedescendant` on host |

### What works vs what does not

| ✅ Works | ❌ Does not work |
| -------- | ---------------- |
| Host → Light DOM label | Light DOM → Shadow label |
| Host → slotted label (light tree) | Host → Shadow label |
| `internals` → Shadow label / listbox | `host.ariaControlsElements` → shadow listbox (Chrome ignores it) |

---

## Seven rules (memorize these)

1. **Match the tree.** Light targets use the host. Shadow targets use `ElementInternals`.
2. **Call `attachInternals()`** in the constructor when wiring shadow-internal links.
3. **Combobox listbox** lives in shadow; **options** live in light DOM and slot in.
4. **Copy shadow label text** to `internals.ariaLabel` and `internals.ariaDescription` — not just element refs.
5. **Give nodes IDs** before setting element refs.
6. **Re-wire when content changes** — use `slotchange` or `MutationObserver`.
7. **Put the role on the host** via `ElementInternals` (`internals.role`, state like `ariaChecked` / `ariaValueNow`).

---

## All demos

Each page has a **Resolved ARIA references** panel per control. Open [index.html](./index.html) for links.

| Demo page | Controls shown | Key takeaway |
| --------- | -------------- | ------------ |
| [Light label](./demo-light-label.html) | Textfield, checkbox, progress bar, combobox | Page label/help → `host.ariaLabelledByElements` / `ariaDescribedByElements` |
| [Shadow label](./demo-shadow-label.html) | Same four | Shadow label/help containers with slotted text → `internals` refs + mirrored strings |
| [Slotted label](./demo-slotted-label.html) | Same four | Slotted nodes stay in light tree → host refs; re-sync on `slotchange` |

**Combobox extras (all pages)**

- Focus stays on the **host** (one tab stop).
- Listbox link: `internals.ariaControlsElements = [listbox]` — never on the host.
- Active option: `aria-activedescendant="option-id"` on the host.

---

## Reusable controllers

Demos share three controllers. Each handles connect/disconnect, ID assignment, ref wiring, and re-sync when label/help changes.

**Full implementation guides:** [`docs/controllers/`](./docs/controllers/README.md)

| Controller | Guide | Use when |
| ---------- | ----- | -------- |
| **`SplitSurfaceAriaController`** | [doc](./docs/controllers/split-surface-aria-controller.md) | Label/help split across host + `ElementInternals` (combobox, host-role fields) |
| **`SlottedFieldAriaController`** | [doc](./docs/controllers/slotted-field-aria-controller.md) | Label/help slotted from the app author (textfield, checkbox, progress bar, combobox) |

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

Legacy function wrappers (`syncHostFieldAriaRefs`, `establishSlottedFieldAriaSync`, etc.) still exist but are deprecated — prefer the controllers above.

---

## Where to put the role (Q2)

| Control | Where role lives | Where focus goes | Demo |
| ------- | ---------------- | ---------------- | ---- |
| Textfield | Host (`ElementInternals`) | Host | [Shadow label demo](./demo-shadow-label.html) |
| Checkbox | Host (`ElementInternals`) | Host | [Shadow label demo](./demo-shadow-label.html) |
| Progress bar | Host (`ElementInternals`) | Usually not focusable | [Shadow label demo](./demo-shadow-label.html) |
| Combobox / picker | Host (`ElementInternals`) | Host | [Shadow label demo](./demo-shadow-label.html) |

---

## How to wire label and help (Q3)

**Rule of thumb:** where the node lives decides where you wire it — not where the role lives. Q2 always places the role on the **host** via `ElementInternals`.

### Label and description by scenario

| Label / help scenario | Label | Description (help text) | Role (Q2 — same for all) | Re-sync when | Controller |
| --------------------- | ----- | ----------------------- | ------------------------ | ------------ | ---------- |
| **Light DOM** — label and help on the page, outside the component | `host.ariaLabelledByElements = [labelEl]` | `host.ariaDescribedByElements = [helpEl]` | `internals.role = 'textbox'` (etc.) | Page nodes added/removed or text changes | [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) |
| **Shadow DOM** — label and help owned inside the component | `internals.ariaLabelledByElements = [labelEl]` | `internals.ariaDescribedByElements = [helpEl]` | Same | Shadow label/help text changes (including slotted content) | [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) |
| **Slotted** — label and help passed in by the app author (`slot="label"`, `slot="description"`) | `host.ariaLabelledByElements = […assigned slot nodes]` | `host.ariaDescribedByElements = […assigned slot nodes]` | Same | `slotchange`, slotted node text changes | [`SlottedFieldAriaController`](./docs/controllers/slotted-field-aria-controller.md) |

### Required extras by scenario

| Scenario | Also do this | Do not do this |
| -------- | ------------ | -------------- |
| Light DOM | Give label/help stable **IDs** before setting element refs. Resolve page nodes via `getElementById`, attributes, or `resolveRefs`. | `host.ariaLabelledByElements` → shadow label nodes |
| Shadow DOM | **Mirror text:** copy label/help string to `internals.ariaLabel` and `internals.ariaDescription` (not refs alone). Use `<span class="field-label">` with an inner `<slot name="label">`, not `<label>` — focus is on the host. | `host.ariaLabelledByElements` → shadow nodes |
| Slotted | Collect assigned nodes from named slots; treat them as light DOM (they stay in the light tree). | Assume slotted nodes are shadow-internal |

### Combobox / picker add-on (any label scenario)

When the popup/listbox lives in shadow, add this regardless of where label/help live:

| Link | Property |
| ---- | -------- |
| Host → shadow listbox | `internals.ariaControlsElements = [listboxEl]` |
| Host → active option | `host.setAttribute('aria-activedescendant', optionId)` |
| Host popup hint | `host.setAttribute('aria-haspopup', 'listbox')` |

Never set `host.ariaControlsElements` to a shadow listbox — Chromium ignores it.

### Demos that match each scenario

| Scenario | Demo |
| -------- | ---- |
| Light DOM | [All four controls — light label](./demo-light-label.html) |
| Shadow DOM | [All four controls — shadow label](./demo-shadow-label.html) |
| Slotted | [All four controls — slotted label](./demo-slotted-label.html) |

**One-line summary:** Q2 is always the host; Q3 splits on **tree location** — light targets wire on `host`, shadow targets wire on `internals` (with text mirroring), and slotted content counts as light.

**Controllers:** [guides](./docs/controllers/README.md) · [`SplitSurfaceAriaController`](./docs/controllers/split-surface-aria-controller.md) · [`SlottedFieldAriaController`](./docs/controllers/slotted-field-aria-controller.md)

---

## Label inside shadow? Pick one approach

Shadow labels **cannot** link from the host. Choose:

| Approach | Best when |
| -------- | --------- |
| **`ElementInternals` + mirror text** | Component owns the label in shadow |
| **Slots** | App author supplies label markup |
| **Page-level label** | Label sits next to the field on the page |

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
| Textfield | Host textbox | See [demo matrix](#demo-matrix) |
| Checkbox | Host checkbox | Same |
| Progress bar | Host progressbar | Same |
| Combobox | Host combobox | Internals → shadow listbox; split label/help; light options |

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
