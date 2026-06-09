# Form fields strategy — Q2 & Q3 recommendations (demo evidence)

Interactive PoCs in this repo support two decisions for 2nd-gen Spectrum form fields:

| Question | Recommendation |
| -------- | -------------- |
| **Q2** — Where do ARIA roles live? | **Heuristic by control class** — not one rule for every field |
| **Q3** — How do label, help, and popup relationships wire across shadow and light DOM? | **Split-surface element references** — host for light DOM targets, `ElementInternals` for shadow-internal targets |

These demos do **not** cover Q1 (form association / `setFormValue`) or Q4 (axe policy). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) and the [Semantic HTML and ARIA guide](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/guides/accessibility-guides/semantic_html_aria.mdx) for broader context.

**[Open all demos in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** — one project; start at [`index.html`](./index.html).

---

## Runnable examples

All demos live at the repo root and are linked from [`index.html`](./index.html).

| Demo | What it exercises |
| ---- | ----------------- |
| [Combobox — shadow label/help](./demo-combobox-shadow-label.html) | Q2 composite widget + Q3 listbox split, shadow label/help via internals |
| [Combobox — light label/help](./demo-combobox-light-label.html) | Q3 light label/help via host element refs |
| [Combobox — mixed label/help](./demo-combobox-mixed-label.html) | Q3 split-surface wiring with both shadow and light targets |
| [Host-role textfield, checkbox, progress bar — shadow labels](./demo-host-shadow-label.html) | Q2 host roles + Q3 shadow label/help via internals |
| [Host-role textfield — slotted label and help](./demo-host-slotted-label.html) | Q3 slotted light label/help via host refs (no cross-root shadow link) |
| [Host-role textfield and checkbox — light labels](./demo-host-light-label.html) | Q3 light label/help on host-role controls |
| [Host-role textfield](./demo-host-textfield-shadow.html) | Q2 host `role="textbox"` |
| [Host-role checkbox](./demo-host-checkbox-shadow.html) | Q2 host `role="checkbox"` |
| [Host-role progress bar](./demo-host-progressbar-shadow.html) | Q2 host `role="progressbar"` |

Related baseline: [Cross-root ARIA element refs CodePen](https://codepen.io/spectrum-css/pen/pvNEVda?editors=0010) (NVDA + VoiceOver described-by validation).

---

## Q2 — Where roles live

**Recommendation:** Choose role placement by **control class**. Use the demos below as the reference implementations.

| Control class | Role / semantics | Focus | Popup / list shell | Demo |
| ------------- | ---------------- | ----- | ------------------ | ---- |
| **Composite closed widgets** (combobox, picker) | **Host** — `role="combobox"`, `aria-expanded`, `aria-activedescendant` | **Host** `tabindex="0"`; focus ring on inner trigger via `:host(:focus)` | **Shadow** `<ul role="listbox">`; **Light DOM** options slotted in | [Combobox demos](./demo-combobox-shadow-label.html) |
| **Native text-like fields** (textfield, textarea) | **Default (production):** native inner `<input>` / `<textarea>`; host is wrapper | `delegatesFocus: true` | N/A | _Not demonstrated here — production default_ |
| **Host-role textfield** (PoC) | **Internals** `role="textbox"` when element refs are supported; inner input `aria-hidden` | Host `tabindex="0"` | N/A | [Textfield demo](./demo-host-textfield-shadow.html) |
| **Native checkbox / switch** | **Default (production):** native `<input type="checkbox">` in shadow | `delegatesFocus` | N/A | _Not demonstrated here — production default_ |
| **Host-role checkbox** (PoC) | **Internals** `role="checkbox"`, `ariaChecked` | Host `tabindex="0"` | N/A | [Checkbox demo](./demo-host-checkbox-shadow.html) |
| **Progress / meter / static indicators** | **Internals** `role="progressbar"` and value properties | Not in tab order unless interactive | N/A | [Progress bar demo](./demo-host-progressbar-shadow.html) |

### Findings from the combobox demo (Q2)

- The **host** owns widget semantics (`role="combobox"`), keyboard handling, `aria-expanded`, and `aria-activedescendant`.
- The **trigger** is not a separate tab stop — it is the visual focus target when the host is focused.
- The **listbox shell** (`role="listbox"`) is in **Shadow DOM**; **option nodes** are in **Light DOM** and slotted into that shell. This split is required for Q3 as well (see below).

### Findings from the host-role demos (Q2)

- **Textfield and checkbox:** widget role and interactive state live on **`ElementInternals`** when reflected element refs are supported; decorative inner markup is presentational (`aria-hidden`).
- **Progress bar:** `role="progressbar"` and value properties (`ariaValueNow`, `ariaValueText`) live on **internals**; the visual track is presentational. The host is **not** focusable.
- **Focus** still lands on the custom element host (`tabindex="0"`) for interactive controls.

---

## Q3 — Label, help, and relationship wiring

**Recommendation:** **Split-surface element references** — partition relationship targets by tree root and assign each to the correct API surface.

```
Light DOM label / help / error  →  host.ariaLabelledByElements / host.ariaDescribedByElements
                                   (fallback: aria-labelledby / aria-describedby ID attributes)

Shadow DOM label / help / error →  internals.ariaLabelledByElements / internals.ariaDescribedByElements
                                   plus mirrored internals.ariaLabel / ariaDescription (always set alongside refs)

Slotted Light DOM label / help  →  host.ariaLabelledByElements / host.ariaDescribedByElements
                                   (nodes stay in the light tree — preferred when consumers supply markup)

Shadow popup / listbox shell    →  internals.ariaControlsElements
                                   (host.ariaControlsElements = [shadowNode] is silently ignored in Chromium)

Slotted Light DOM options       →  host aria-activedescendant="option-id"
                                   (ID attribute — not ariaActiveDescendantElement)
```

Implementation pattern: [`syncAriaElementRefs`](./combobox-base.js) in the combobox PoC and [`syncHostFieldAriaRefs`](./form-field-base.js) in the host-role PoCs.

### What the demos validate

| Pattern | Demo | Result |
| ------- | ---- | ------ |
| Shadow label/help → internals | [Combobox shadow label](./demo-combobox-shadow-label.html), [host shadow labels](./demo-host-shadow-label.html) | `internals.ariaLabelledByElements` / `ariaDescribedByElements` plus mirrored `ariaLabel` / `ariaDescription` |
| Slotted label/help → host | [Textfield slotted label](./demo-host-slotted-label.html) | `host.ariaLabelledByElements` / `ariaDescribedByElements`; no inward cross-root link |
| Light label/help → host | [Combobox light label](./demo-combobox-light-label.html), [host light labels](./demo-host-light-label.html) | `host.ariaLabelledByElements` / `ariaDescribedByElements` read back correctly |
| Mixed shadow + light label/help | [Combobox mixed label](./demo-combobox-mixed-label.html) | Each target wired on its own surface |
| Host combobox → shadow listbox | Combobox (all variants) | `internals.ariaControlsElements` succeeds; host assignment does not |
| Host → light option IDs | Combobox (all variants) | `aria-activedescendant` on host points at slotted light option `id`s |
| Shadow listbox + light options | Combobox (all variants) | Listbox role on shadow `<ul>`; options authored as `<li slot="option">` in light DOM |

### Rules derived from the demos

1. **Never rely on shadow-only IDs** for `aria-controls`, `aria-labelledby`, or `aria-describedby` on the host — they do not resolve across shadow boundaries.
2. **Always call `attachInternals()`** in the constructor when wiring shadow-internal relationships.
3. **Keep listbox options in Light DOM** — shadow-resident option IDs do not work with host `aria-activedescendant`.
4. **Label and help may live in shadow or light DOM** — both are first-class; the wiring surface follows the tree root, not the authoring preference.
5. **Use ID attribute fallback** for light-only refs when `aria*Elements` is unavailable; shadow-only refs require element refs.
6. **Mirror shadow label/help text** on `internals.ariaLabel` / `ariaDescription` in addition to element refs — readback and some AT paths are more reliable with the mirrored string properties.
7. **Re-sync on text changes** — use `MutationObserver` or `slotchange` when label/help content is dynamic.

### Fixing cross-root shadow label wiring

Shadow-resident label and help nodes **cannot** be linked from the host via `host.ariaLabelledByElements` — that API only resolves targets in the same root as the host (Light DOM). Use one of these patterns:

| Approach | When to use | Wiring |
| -------- | ----------- | ------ |
| **Internals element refs + mirror** (demos default) | Label/help authored inside shadow | `internals.ariaLabelledByElements` / `ariaDescribedByElements` **and** `internals.ariaLabel` / `ariaDescription` copied from shadow text |
| **Slotted label/help** | Consumers supply label markup | Project light DOM nodes through named slots; wire with `host.ariaLabelledByElements` — see [slotted demo](./demo-host-slotted-label.html) |
| **Light DOM label/help** | Page-level labels | External `<label>` / help nodes; wire with `host.ariaLabelledByElements` — see [light label demo](./demo-host-light-label.html) |

Shared helpers: [`mirrorShadowAccessibleName`](./form-field-base.js), [`watchRefTargets`](./form-field-base.js), [`watchSlottedFieldRefs`](./form-field-base.js).

---

## Applying Q2 + Q3 together

| Component | Q2 (role) | Q3 (relationships) |
| --------- | --------- | ------------------ |
| Combobox / picker | Host combobox | Internals → shadow listbox; host/internals label/help split; light slotted options + host `aria-activedescendant` |
| Textfield (production) | Inner native input | Light label via `for` + `delegatesFocus`; shadow help via internal described-by |
| Textfield (host-role PoC) | Internals textbox | Shadow label/help via internals + mirror; slotted or light label via host |
| Checkbox (host-role PoC) | Internals checkbox | Same label/help split as combobox |
| Progress bar (host-role PoC) | Internals progressbar | Shadow label/description via internals + mirror; track presentational |

---

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:8080/index.html](http://localhost:8080/index.html) — the index links to every demo. Each page includes a live **Resolved ARIA references** panel.

---

## References

- [ElementInternals.ariaControlsElements (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements)
- [Reflected element references (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
- [Focus management strategy RFC (SWC)](https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/03_project-planning/05_strategies/focus-management-strategy-rfc.md)
