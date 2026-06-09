# Form fields strategy — Q2 & Q3 recommendations (demo evidence)

Interactive PoCs in this repo support two decisions for 2nd-gen Spectrum form fields:

| Question | Recommendation |
| -------- | -------------- |
| **Q2** — Where do ARIA roles live? | **Heuristic by control class** — not one rule for every field |
| **Q3** — How do label, help, and popup relationships wire across shadow and light DOM? | **Split-surface element references** — host for light DOM targets, `ElementInternals` for shadow-internal targets |

These demos do **not** cover Q1 (form association / `setFormValue`) or Q4 (axe policy). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) and the [Semantic HTML and ARIA guide](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/guides/accessibility-guides/semantic_html_aria.mdx) for broader context.

---

## Runnable examples

| Demo | What it exercises | StackBlitz |
| ---- | ----------------- | ---------- |
| [Combobox ARIA element refs](./combobox-aria-element-refs/) | Q2 composite widget + Q3 listbox split, label/help split, `aria-activedescendant` | [Open](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/combobox-aria-element-refs) |
| [Textfield](./host-role-form-controls/demo-textfield-shadow.html) | Q2 host `role="textbox"` + Q3 shadow label/help via internals | [Open](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/textfield) |
| [Checkbox](./host-role-form-controls/demo-checkbox-shadow.html) | Q2 host `role="checkbox"` + Q3 shadow label/help via internals | [Open](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/checkbox) |
| [Progress bar](./host-role-form-controls/demo-progressbar-shadow.html) | Q2 host `role="progressbar"` + Q3 shadow label/description via internals | [Open](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/progressbar) |
| [index](./host-role-form-controls/) | All host-role PoCs + light DOM label variant | [Open](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls) |

Related baseline: [Cross-root ARIA element refs CodePen](https://codepen.io/spectrum-css/pen/pvNEVda?editors=0010) (NVDA + VoiceOver described-by validation).

---

## Q2 — Where roles live

**Recommendation:** Choose role placement by **control class**. Use the demos below as the reference implementations.

| Control class | Role / semantics | Focus | Popup / list shell | Demo |
| ------------- | ---------------- | ----- | ------------------ | ---- |
| **Composite closed widgets** (combobox, picker) | **Host** — `role="combobox"`, `aria-expanded`, `aria-activedescendant` | **Host** `tabindex="0"`; focus ring on inner trigger via `:host(:focus)` | **Shadow** `<ul role="listbox">`; **Light DOM** options slotted in | [Combobox PoC](./combobox-aria-element-refs/) |
| **Host-role textfield** (PoC) | **Host** `role="textbox"`; inner input `aria-hidden` | Host `tabindex="0"` | N/A | [StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/textfield) |
| **Host-role checkbox** (PoC) | **Host** `role="checkbox"`, `aria-checked` | Host `tabindex="0"` | N/A | [StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/checkbox) |
| **Progress / meter / static indicators** | **Host** carries widget role | Not in tab order unless interactive | N/A | [StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/host-role-form-controls/stackblitz/progressbar) |

### Findings from the combobox demo (Q2)

- The **host** owns widget semantics (`role="combobox"`), keyboard handling, `aria-expanded`, and `aria-activedescendant`.
- The **trigger** is not a separate tab stop — it is the visual focus target when the host is focused.
- The **listbox shell** (`role="listbox"`) is in **Shadow DOM**; **option nodes** are in **Light DOM** and slotted into that shell. This split is required for Q3 as well (see below).

### Findings from the host-role demos (Q2)

- **Textfield and checkbox:** role and interactive state live on the host; decorative inner markup is presentational (`aria-hidden`).
- **Progress bar:** `role="progressbar"` and value attributes (`aria-valuenow`, `aria-valuetext`) live on the host; the visual track is presentational. The host is **not** focusable.

---

## Q3 — Label, help, and relationship wiring

**Recommendation:** **Split-surface element references** — partition relationship targets by tree root and assign each to the correct API surface.

```
Light DOM label / help / error  →  host.ariaLabelledByElements / host.ariaDescribedByElements
                                   (fallback: aria-labelledby / aria-describedby ID attributes)

Shadow DOM label / help / error →  internals.ariaLabelledByElements / internals.ariaDescribedByElements

Shadow popup / listbox shell    →  internals.ariaControlsElements
                                   (host.ariaControlsElements = [shadowNode] is silently ignored in Chromium)

Slotted Light DOM options       →  host aria-activedescendant="option-id"
                                   (ID attribute — not ariaActiveDescendantElement)
```

Implementation pattern: [`syncAriaElementRefs`](./combobox-aria-element-refs/combobox-base.js) in the combobox PoC and [`syncHostFieldAriaRefs`](./host-role-form-controls/form-field-base.js) in the host-role PoCs.

### What the demos validate

| Pattern | Demo | Result |
| ------- | ---- | ------ |
| Shadow label/help → internals | Combobox (shadow label variant), all host-role shadow-label pages | `internals.ariaLabelledByElements` / `ariaDescribedByElements` read back correctly |
| Light label/help → host | Combobox (light label variant), host-role light-label page | `host.ariaLabelledByElements` / `ariaDescribedByElements` read back correctly |
| Mixed shadow + light label/help | Combobox (mixed variant) | Each target wired on its own surface |
| Host combobox → shadow listbox | Combobox (all variants) | `internals.ariaControlsElements` succeeds; host assignment does not |
| Host → light option IDs | Combobox (all variants) | `aria-activedescendant` on host points at slotted light option `id`s |
| Shadow listbox + light options | Combobox (all variants) | Listbox role on shadow `<ul>`; options authored as `<li slot="option">` in light DOM |

### Rules derived from the demos

1. **Never rely on shadow-only IDs** for `aria-controls`, `aria-labelledby`, or `aria-describedby` on the host — they do not resolve across shadow boundaries.
2. **Always call `attachInternals()`** in the constructor when wiring shadow-internal relationships.
3. **Keep listbox options in Light DOM** — shadow-resident option IDs do not work with host `aria-activedescendant`.
4. **Label and help may live in shadow or light DOM** — both are first-class; the wiring surface follows the tree root, not the authoring preference.
5. **Use ID attribute fallback** for light-only refs when `aria*Elements` is unavailable; shadow-only refs require element refs.

---

## Applying Q2 + Q3 together

| Component | Q2 (role) | Q3 (relationships) |
| --------- | --------- | ------------------ |
| Combobox / picker | Host combobox | Internals → shadow listbox; host/internals label/help split; light slotted options + host `aria-activedescendant` |
| Textfield (production) | Inner native input | Light label via `for` + `delegatesFocus`; shadow help via internal described-by |
| Textfield (host-role PoC) | Host textbox | Same label/help split as combobox; inner input presentational |
| Checkbox (host-role PoC) | Host checkbox | Same label/help split as combobox |
| Progress bar (host-role PoC) | Host progressbar | Shadow label/description via internals; track presentational |

---

## Running locally

**Combobox**

```bash
cd combobox-aria-element-refs
npm install && npm start
```

**Host-role controls**

```bash
cd host-role-form-controls
npm install && npm start                 # index
npm run start:textfield                  # textfield only
npm run start:checkbox                   # checkbox only
npm run start:progressbar                # progress bar only
```

Open `http://localhost:8080/index.html` for each folder. Each demo includes a live **Resolved ARIA references** panel.

---

## References

- [ElementInternals.ariaControlsElements (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements)
- [Reflected element references (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
- [Focus management strategy RFC (SWC)](https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/03_project-planning/05_strategies/focus-management-strategy-rfc.md)
