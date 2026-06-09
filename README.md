# Form fields strategy — Q2 & Q3 recommendations (demo evidence)

Interactive PoCs in this repo support two decisions for 2nd-gen Spectrum form fields:

| Question | Recommendation |
| -------- | -------------- |
| **Q2** — Where do ARIA roles live? | **Heuristic by control class** — not one rule for every field |
| **Q3** — How do label, help, and popup relationships wire across shadow and light DOM? | **Split-surface element references** — host for light DOM targets, `ElementInternals` for shadow-internal targets |

These demos do **not** cover Q1 (form association / `setFormValue`) or Q4 (axe policy). See [SWC-48](https://jira.corp.adobe.com/browse/SWC-48) and the [Semantic HTML and ARIA guide](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/guides/accessibility-guides/semantic_html_aria.mdx) for broader context.

**[Open all demos in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** — one project; start at [`index.html`](./index.html).

---

## What we learned from building the demos

These PoCs were built iteratively and debugged in StackBlitz, VoiceOver, and NVDA. The findings below are the practical lessons — not just the intended design.

### Platform constraints (non-negotiable)

| Observation | Implication |
| ----------- | ----------- |
| **`host.ariaLabelledByElements` / `ariaDescribedByElements` only resolve Light DOM targets** | Shadow-resident label/help **cannot** be linked from the host. Use `internals.ariaLabelledByElements` for shadow-inward refs, or keep label/help in Light DOM (external or slotted). |
| **`host.ariaControlsElements = [shadowNode]` is silently ignored in Chromium** | Shadow popup/listbox shells must use **`internals.ariaControlsElements`**. Do not assign shadow-internal controls on the host. |
| **Inner shadow surface → light DOM works via element refs** | Set `innerInput.ariaLabelledByElements` / `ariaDescribedByElements` on the **inner control** (native input, inner progressbar). Validated in the [CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda) and [cross-root fields demo](./demo-cross-root-fields.html). No `ElementInternals` required. |
| **Light DOM → shadow inner does not work** | Same as host → shadow: no API can link outward from light to shadow-resident label/help nodes. |
| **ID attributes on the host do not cross shadow boundaries** | `aria-labelledby`, `aria-describedby`, and `aria-controls` on the host cannot point at shadow-only IDs. Same split as element refs. |
| **Host `aria-activedescendant` needs Light DOM option IDs** | Slotted options work; shadow-resident option IDs do not resolve from the host. The demos use the **ID attribute** (`aria-activedescendant="option-id"`), not `ariaActiveDescendantElement`. |
| **Reflected element refs require stable target nodes** | Assign IDs to every label/help/listbox node before setting `aria*Elements`. Use presentational spans, not shadow `<label>` without a valid `for` target. |

### The split-surface mental model

Think of the custom element as having **two ARIA wiring surfaces**:

```
Light DOM (host)                         Shadow DOM (internals)
────────────────                         ──────────────────────
host.ariaLabelledByElements              internals.ariaLabelledByElements
host.ariaDescribedByElements             internals.ariaDescribedByElements
host aria-activedescendant → light IDs   internals.ariaControlsElements → shadow listbox
host tabindex / keyboard / focus         internals.role + widget state (when refs supported)
```

- **Outward and light-tree relationships** → host.
- **Inward shadow relationships** → `ElementInternals`.
- **Focus and keyboard** stay on the host for composite widgets and host-role PoCs.

This is why shadow label/help “crosses a root” — but only through **`internals`**, never by setting refs on the host and expecting them to reach into shadow.

### Patterns that worked reliably

1. **Mirror shadow text on internals** — Set `internals.ariaLabel` / `ariaDescription` from shadow label/help text **in addition to** element refs. Element-ref readback and some AT/browser combinations are flaky; the mirrored string properties give a dependable accessible name/description.
2. **Slotted label/help** — When consumers supply markup, project it through named slots. Slotted nodes stay in the light tree, so `host.ariaLabelledByElements` works without any cross-root shadow wiring. On `slotchange`, re-collect assigned nodes, assign IDs when missing, and re-wire refs — see the [slotted demo](./demo-host-slotted-label.html) and [dynamic slotted demo](./demo-host-slotted-dynamic.html).
3. **Listbox shell in shadow, options in light DOM** — `<ul role="listbox">` inside shadow; `<li slot="option">` authored in light DOM. Required for both `internals.ariaControlsElements` and host `aria-activedescendant`.
4. **Widget role and state on internals** — When reflected element refs are supported, set `internals.role`, `internals.ariaChecked`, and progress value properties on internals instead of duplicating host attributes.
5. **Re-sync on change** — Use `MutationObserver` on label/help nodes and `slotchange` on slotted refs when content is dynamic ([`watchRefTargets`](./form-field-base.js), [`watchSlottedFieldRefs`](./form-field-base.js)).

### Pitfalls we hit while building (and fixes)

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Shadow label/help missing in AT | Tried to wire shadow nodes via `host.ariaLabelledByElements` | Use `internals` element refs + mirrored `ariaLabel` / `ariaDescription` |
| Empty “Resolved ARIA references” log | `querySelector('[data-aria-log=…]')` matched the **custom element** before the `<pre>` | Target `.log[data-aria-log="…"]` only |
| Log empty on first paint | `connectedCallback` runs before the following `<pre>` exists in the document | Lazy resolve + `queueMicrotask()` refresh ([`createLogRefresher`](./form-field-base.js)) |
| Element refs read back as `[]` | Missing IDs on shadow label/help targets | [`prepareRefTargets`](./form-field-base.js) assigns stable IDs before wiring |
| Shadow `<label>` did not associate | Focusable control is the **host** outside shadow; shadow `<label for>` cannot target it | Use `<span class="field-label">` for shadow-resident labels in host-role PoCs |
| Listbox not linked to combobox | `host.ariaControlsElements = [listbox]` | `internals.ariaControlsElements = [listbox]` |

### Authoring guidance for 2nd-gen SWC

| Label/help authored… | Recommended wiring |
| -------------------- | ------------------ |
| In shadow (component-owned) | `internals.ariaLabelledByElements` + mirrored `ariaLabel` / `ariaDescription` |
| Slotted from consumer markup | `host.ariaLabelledByElements` / `ariaDescribedByElements` |
| External in page Light DOM (host-role PoC) | `host.ariaLabelledByElements` / `ariaDescribedByElements` |
| External in page Light DOM (production inner control) | `inner.ariaLabelledByElements` / `ariaDescribedByElements` — [cross-root demo](./demo-cross-root-fields.html) |

**Production default for textfields and checkboxes** remains native inner controls with `delegatesFocus` — the host-role demos exist to validate the split-surface model for composite widgets and edge cases, not to replace native semantics for simple fields.

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
| [Host-role textfield — dynamic slotted ID refs](./demo-host-slotted-dynamic.html) | Q3 slotchange re-collects assigned nodes and updates ID / element refs |
| [Host-role textfield and checkbox — light labels](./demo-host-light-label.html) | Q3 light label/help on host-role controls |
| [Host-role textfield](./demo-host-textfield-shadow.html) | Q2 internals `role="textbox"` |
| [Host-role checkbox](./demo-host-checkbox-shadow.html) | Q2 internals `role="checkbox"` |
| [Host-role progress bar](./demo-host-progressbar-shadow.html) | Q2 internals `role="progressbar"` |
| [Cross-root inner surface — textfield, checkbox, progress bar](./demo-cross-root-fields.html) | CodePen pattern: inner shadow control → light DOM label/help via element refs |

Related baseline: [Cross-root ARIA element refs CodePen](https://codepen.io/spectrum-css/pen/pvNEVda?editors=0010) (NVDA + VoiceOver described-by validation). The [cross-root fields demo](./demo-cross-root-fields.html) applies the same shadow → light wiring to form controls.

---

## Learnings by demo

Each PoC taught something specific. Use this section to pick the right reference implementation for a given authoring pattern.

### Combobox

#### [Combobox — shadow label/help](./demo-combobox-shadow-label.html)

| | |
| --- | --- |
| **Pattern** | Composite widget with component-owned label and help in shadow |
| **Role** | `internals.role = "combobox"` (fallback: host attribute) |
| **Focus** | Host `tabindex="0"`; trigger is visual only |
| **Label/help** | `internals.ariaLabelledByElements` / `ariaDescribedByElements` + mirrored `ariaLabel` / `ariaDescription` |
| **Listbox** | `internals.ariaControlsElements = [shadowListbox]` — **host assignment is silently ignored** |
| **Options** | Light DOM `<li slot="option">`; host `aria-activedescendant` points at option IDs |

**What we learned:** Shadow-resident label, help, and listbox all wire through **`ElementInternals`**, not the host. Shadow `<span>` labels work; shadow `<label>` does not when the focus target is outside shadow. Mirroring label/help text on `internals.ariaLabel` / `ariaDescription` improved AT reliability beyond element-ref readback alone.

#### [Combobox — light label/help](./demo-combobox-light-label.html)

| | |
| --- | --- |
| **Pattern** | Page-level label and help; combobox shadow contains trigger + listbox only |
| **Label/help** | `host.ariaLabelledByElements` / `ariaDescribedByElements` → external light DOM nodes |
| **Listbox / options** | Same shadow listbox + light slotted options split as the shadow-label variant |

**What we learned:** When label and help live in Light DOM, the **host** is the correct wiring surface. The listbox split (shadow shell, light options) is unchanged — only label/help placement differs. `label-target` / `help-target` attributes resolve external nodes by ID.

#### [Combobox — mixed label/help](./demo-combobox-mixed-label.html)

| | |
| --- | --- |
| **Pattern** | Supplemental shadow label/help **and** external light label/help on one control |
| **Label/help** | Light targets → host element refs; shadow targets → internals element refs + mirror |
| **Partition rule** | Tree root determines surface — not authoring preference |

**What we learned:** Both surfaces can be active on one component. Do not merge light and shadow targets onto a single API — partition first, then assign each group to host or internals. This is the canonical illustration of the split-surface model.

---

### Cross-root inner surface ([CodePen POC](https://codepen.io/spectrum-css/pen/pvNEVda))

#### [Textfield, checkbox, and progress bar — shadow → light refs](./demo-cross-root-fields.html)

| | |
| --- | --- |
| **Pattern** | Inner shadow control is the ARIA surface; label/help stay in Light DOM |
| **Textfield / checkbox** | Native `<input>` in shadow with `delegatesFocus` |
| **Progress bar** | `<div role="progressbar">` in shadow |
| **Label/help** | `inner.ariaLabelledByElements` / `ariaDescribedByElements` → external nodes |
| **APIs not used** | No host refs, no `ElementInternals`, no string `aria-labelledby` / `aria-describedby` |

**What we learned:** **Shadow → light** cross-root works on the **inner interactive element** — the same direction validated in the CodePen (inner button → light tooltip). This is the best fit for **production textfields and checkboxes** with external or page-level labels. **Light → shadow does not work**; string ID attributes from shadow cannot cross roots either, so there is no fallback when element refs are unavailable. Element refs do not write `aria-describedby` to the DOM — AT must read the reflected association.

---

### Host-role form controls (PoC — not production default)

These demos put widget semantics on the custom element host (via `internals` when element refs are supported). Inner markup is presentational. They validate the split-surface model for composite-like edge cases; **production textfields and checkboxes should use native inner controls** ([cross-root demo](./demo-cross-root-fields.html)).

#### [Textfield, checkbox, and progress bar — shadow labels](./demo-host-shadow-label.html)

| | |
| --- | --- |
| **Pattern** | All three control types with shadow-resident label and help |
| **Role / state** | `internals.role`, `internals.ariaChecked`, progress value properties |
| **Label/help** | `internals` element refs + mirrored `ariaLabel` / `ariaDescription` |
| **Focus** | Host `tabindex="0"` for textfield and checkbox; progress bar not focusable |

**What we learned:** The same shadow-label wiring as the combobox applies to simple host-role fields. Combining all three on one page exposed log-panel and ID-assignment bugs that also affected the individual demos (see pitfalls table above).

#### [Textfield — slotted label and help](./demo-host-slotted-label.html)

| | |
| --- | --- |
| **Pattern** | Consumer-authored label/help projected through named slots |
| **Tree location** | Slotted nodes remain in the **light tree** even though visually inside the component |
| **Label/help** | `host.ariaLabelledByElements` / `ariaDescribedByElements` |

**What we learned:** Slotted label/help avoids inward cross-root wiring entirely. Prefer this over shadow-resident labels when consumers supply markup. No `ElementInternals` label refs needed.

#### [Textfield — dynamic slotted ID refs](./demo-host-slotted-dynamic.html)

| | |
| --- | --- |
| **Pattern** | Same as slotted label, plus runtime slot content changes |
| **Sync triggers** | `slotchange` re-collects assigned nodes; `MutationObserver` on text changes |
| **IDs** | Component assigns stable IDs when author omits them; preserves author IDs when provided |
| **Multi-ref** | Supports multiple description nodes (e.g. help + error) |

**What we learned:** Ref wiring must be **re-entrant** — disconnect and re-attach watchers when slot assignments change. Interactive preset buttons proved refs update correctly when slotted nodes are replaced, added, or removed. Author IDs and auto-assigned IDs both work.

#### [Textfield and checkbox — light DOM labels](./demo-host-light-label.html)

| | |
| --- | --- |
| **Pattern** | External `<label>` and help `<span>` siblings; host-role widget semantics |
| **Label/help** | `host.ariaLabelledByElements` / `ariaDescribedByElements` via `label-target` / `help-target` |
| **Contrast** | Host is focus target and owns role — differs from cross-root inner-surface pattern |

**What we learned:** Light DOM label/help on a **host-role** PoC uses host element refs, not inner input refs. Compare with [cross-root fields](./demo-cross-root-fields.html): production-shaped controls should wire refs on the **inner native control**, not the host.

#### [Host-role textfield](./demo-host-textfield-shadow.html)

| | |
| --- | --- |
| **Pattern** | `internals.role = "textbox"`; inner `<input aria-hidden>` |
| **Input** | Host handles keyboard; inner input is decorative |
| **Label/help** | Shadow → internals refs + mirror |

**What we learned:** Host-role textbox is viable for PoC but duplicates native input semantics. Useful for understanding split-surface wiring, not recommended for production textfields.

#### [Host-role checkbox](./demo-host-checkbox-shadow.html)

| | |
| --- | --- |
| **Pattern** | `internals.role = "checkbox"`; `internals.ariaChecked` |
| **Interaction** | Space and click on host toggle state |
| **Label/help** | Shadow → internals refs + mirror |

**What we learned:** Checkbox state belongs on **`internals.ariaChecked`** when element refs are supported (not duplicated on host attributes). Same shadow-label constraints as other host-role demos.

#### [Host-role progress bar](./demo-host-progressbar-shadow.html)

| | |
| --- | --- |
| **Pattern** | `internals.role = "progressbar"`; value on `internals.ariaValueNow` / `ariaValueText` |
| **Focus** | Not in tab order (`tabindex` omitted) |
| **Visual track** | Presentational (`aria-hidden`) |

**What we learned:** Static indicators can live entirely on internals with shadow label/help via internals refs + mirror. Value animation updates internals properties, not host attributes.

---

### Quick reference — which demo for which question?

| Question | Start here |
| -------- | ---------- |
| Where should combobox role and listbox wiring live? | [Combobox shadow label](./demo-combobox-shadow-label.html) |
| External page label for a combobox? | [Combobox light label](./demo-combobox-light-label.html) |
| Both shadow and light label/help on one field? | [Combobox mixed label](./demo-combobox-mixed-label.html) |
| Production textfield/checkbox with external label? | [Cross-root fields](./demo-cross-root-fields.html) |
| Consumer-supplied label through slots? | [Slotted label](./demo-host-slotted-label.html) |
| Dynamic slot content / error messages? | [Dynamic slotted refs](./demo-host-slotted-dynamic.html) |
| Shadow-resident label inside the component? | [Host shadow labels](./demo-host-shadow-label.html) or combobox shadow variant |
| Why can't host refs reach shadow labels? | [What we learned → split-surface model](#the-split-surface-mental-model) + [Fixing cross-root shadow label wiring](#fixing-cross-root-shadow-label-wiring) |

---

## Q2 — Where roles live

**Recommendation:** Choose role placement by **control class**. Use the demos below as the reference implementations.

| Control class | Role / semantics | Focus | Popup / list shell | Demo |
| ------------- | ---------------- | ----- | ------------------ | ---- |
| **Composite closed widgets** (combobox, picker) | **Internals** `role="combobox"` when element refs supported; host owns `aria-expanded`, `aria-activedescendant`, keyboard | **Host** `tabindex="0"`; focus ring on inner trigger via `:host(:focus)` | **Shadow** `<ul role="listbox">`; **Light DOM** options slotted in | [Combobox demos](./demo-combobox-shadow-label.html) |
| **Native text-like fields** (textfield, textarea) | **Default (production):** native inner `<input>` / `<textarea>`; host is wrapper | `delegatesFocus: true` | N/A | _Not demonstrated here — production default_ |
| **Host-role textfield** (PoC) | **Internals** `role="textbox"` when element refs are supported; inner input `aria-hidden` | Host `tabindex="0"` | N/A | [Textfield demo](./demo-host-textfield-shadow.html) |
| **Native checkbox / switch** | **Default (production):** native `<input type="checkbox">` in shadow | `delegatesFocus` | N/A | _Not demonstrated here — production default_ |
| **Host-role checkbox** (PoC) | **Internals** `role="checkbox"`, `ariaChecked` | Host `tabindex="0"` | N/A | [Checkbox demo](./demo-host-checkbox-shadow.html) |
| **Progress / meter / static indicators** | **Internals** `role="progressbar"` and value properties | Not in tab order unless interactive | N/A | [Progress bar demo](./demo-host-progressbar-shadow.html) |

### Findings from the combobox demo (Q2)

- **Combobox role** lives on **`ElementInternals`** when reflected element refs are supported (fallback: host `role="combobox"` attribute).
- The **host** still owns keyboard handling, `aria-expanded`, and `aria-activedescendant`.
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
| Slotted label/help → host | [Textfield slotted label](./demo-host-slotted-label.html), [dynamic slotted refs](./demo-host-slotted-dynamic.html) | `host.ariaLabelledByElements` / `ariaDescribedByElements`; IDs assigned on sync; updates on `slotchange` |
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

Shared helpers: [`mirrorShadowAccessibleName`](./form-field-base.js), [`watchRefTargets`](./form-field-base.js), [`watchSlottedFieldRefs`](./form-field-base.js), [`establishSlottedFieldAriaSync`](./form-field-base.js).

---

## Cross-root inner surface (CodePen pattern)

The [ariaDescribedByElements CodePen](https://codepen.io/spectrum-css/pen/pvNEVda) validates **shadow → light** element references on an **inner shadow interactive surface** — not the host, not `ElementInternals`. The [cross-root fields demo](./demo-cross-root-fields.html) applies this to textfield, checkbox, and progress bar.

| Component | Inner ARIA surface | Light DOM wiring |
| --------- | ------------------ | -------------- |
| Textfield | Native `<input type="text">` in shadow | `input.ariaLabelledByElements` / `ariaDescribedByElements` → external label + help |
| Checkbox | Native `<input type="checkbox">` in shadow | Same |
| Progress bar | `<div role="progressbar">` in shadow | Same |

```javascript
const inner = host.shadowRoot.querySelector('[data-aria-surface]');
const label = document.getElementById('email-label');
const help = document.getElementById('email-help');

inner.ariaLabelledByElements = [label];
inner.ariaDescribedByElements = [help];
```

**When to use this vs split-surface / internals:**

| Scenario | Pattern |
| -------- | ------- |
| Production textfield/checkbox with light DOM or slotted labels | **Inner surface element refs** (this CodePen pattern) |
| Shadow-resident label/help | **`ElementInternals`** element refs + mirrored `ariaLabel` |
| Composite widget (combobox) with host keyboard | Host focus + **internals** for shadow listbox and shadow label/help |
| Help/tooltip in light DOM, button-like control in shadow | **Inner surface element refs** (original CodePen) |

Shared helper: [`wireInnerCrossRootAriaRefs`](./cross-root-field-base.js).

---

## Applying Q2 + Q3 together

| Component | Q2 (role) | Q3 (relationships) |
| --------- | --------- | ------------------ |
| Combobox / picker | Internals combobox (refs supported) | Internals → shadow listbox; host/internals label/help split; light slotted options + host `aria-activedescendant` |
| Textfield (production) | Inner native input | Light label via element refs on inner input ([cross-root demo](./demo-cross-root-fields.html)) or `for` + `delegatesFocus` |
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
