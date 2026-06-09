# Form fields strategy RFC (discussion)

**Status:** Proposed — for team review before scaling 2nd-gen form field migration  
**Audience:** SWC maintainers, a11y stakeholders, 2nd-gen migration contributors  
**Non-goal:** This document does not implement a shared mixin or migrate a production SWC component. It records direction only.

---

## Summary

PoC work in [`combobox-aria-element-refs/`](./combobox-aria-element-refs/) validates a **split-surface ARIA model** for encapsulated form controls. The team should adopt this as the default 2nd-gen forms strategy unless a component class has a documented exception.

**Recommendation in one sentence:** Put **widget semantics and focus on the host**, wire **shadow-internal relationships through `ElementInternals` reflected element references**, keep **consumer-owned or slotted content in Light DOM** where ID-based references or slotted composition are required, and **centralize the wiring in a shared form-field base/mixin** derived from the PoC’s `syncAriaElementRefs` pattern.

---

## PoC evidence

| Artifact | What it proves |
| -------- | -------------- |
| **[Combobox ARIA element reference demos](./combobox-aria-element-refs/)** (this repo) | `ElementInternals.ariaControlsElements` links host combobox → shadow listbox; shadow label/help via `internals.ariaLabelledByElements` / `ariaDescribedByElements`; light label/help via host element refs; slotted light options + host `aria-activedescendant`; host focus with trigger focus ring via `:host(:focus)` |
| **[StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/combobox-aria-element-refs)** | Runnable copy of the PoC (`npm start`) |
| **[Cross-root ARIA element refs CodePen](https://codepen.io/spectrum-css/pen/pvNEVda?editors=0010)** | Baseline Apr 2025 `aria*Elements` IDL on native controls; NVDA + VoiceOver validation for described-by wiring (related surface used by form fields) |

**Related SWC context**

- Epic: [SWC-48 — ElementInternals / form-associated custom elements](https://jira.corp.adobe.com/browse/SWC-48)
- Cross-root ARIA guide: [Semantic HTML and ARIA (Storybook)](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/guides/accessibility-guides/semantic_html_aria.mdx) — also published in SWC Storybook as **Accessibility → Semantic HTML and ARIA**
- Focus strategy (host vs inner): [Focus management strategy RFC](https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/03_project-planning/05_strategies/focus-management-strategy-rfc.md)
- Design board: _Miro Form fields RFC board_ — link when publishing the SWC PR that adopts this doc

---

## Epic questions (Q1–Q4)

After this RFC is **Accepted**, contributors should not re-litigate these per component. Use the summary table below; full rationale follows.

| # | Question | Recommended answer |
| - | -------- | ------------------ |
| **Q1** | ElementInternals / form-associated custom elements? | **Hybrid with allowlist** |
| **Q2** | Where do ARIA roles live by default? | **Heuristic by control class** (see table) |
| **Q3** | IDREF strategy for label / help / error? | **Split-surface: host for light, internals for shadow; slotted light for IDREF targets** |
| **Q4** | axe-core policy for false positives? | **Story-level exclusions with rationale + upstream tracking** |

---

## Q1 — ElementInternals and form association

### Recommendation: **Hybrid with allowlist**

| Use `ElementInternals` | Do not require (yet) |
| ---------------------- | -------------------- |
| `ariaControlsElements` → shadow popup / listbox shell | `setFormValue` / full **form-associated** lifecycle on every field |
| `ariaLabelledByElements` / `ariaDescribedByElements` → **shadow-internal** label, help, error nodes | `type="submit"` / `reset` on button-like controls until axe + platform story is clear |
| Future: `ariaErrorMessageElements` for shadow-resident error text | Assuming `host.ariaControlsElements = [shadowNode]` works — **it does not**; always use **internals** for inward shadow refs |

**Rationale (from PoC):** Setting `host.ariaControlsElements = [shadowListbox]` is silently ignored in Chromium; `internals.ariaControlsElements` readback succeeds. Custom elements must call `attachInternals()` in the constructor for shadow-internal relationship targets.

**Browser / AT notes**

- Reflected element references (`aria*Elements`) are [Baseline Apr 2025](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements) in Chromium and Safari; verify Firefox on your matrix before dropping ID fallbacks.
- Form-associated custom elements (`static formAssociated = true`, `setFormValue`, validity APIs) remain on an **allowlist** (e.g. `swc-textfield`, `swc-picker`, `swc-checkbox`) gated on SWC-48 + axe maturity — not on presentational or button-only components.
- Until allowlisted, document `type="button"` defaults and native `<button>` / `<input>` submission patterns in migration guides (same deferral as [`swc-button` migration guide](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/components/button/migration-guide.mdx)).

---

## Q2 — Where roles live

### Recommendation: **Heuristic by control class** (not one rule for all fields)

| Control class | Role / semantics | Focus | Popup / list shell | Notes |
| ------------- | ---------------- | ----- | ------------------ | ----- |
| **Composite closed widgets** (combobox, picker, select-like) | **Host** (`role="combobox"`, `aria-expanded`, …) | **Host** `tabindex="0"`; visual ring on inner **trigger** via `:host(:focus) .trigger` | **Shadow** listbox/menu shell; **options slotted light** | Matches [combobox PoC](./combobox-aria-element-refs/) |
| **Native text-like fields** (textfield, textarea, number-field) | **Native inner** `<input>` / `<textarea>`; host is presentation wrapper | **`delegatesFocus: true`** → inner native control | N/A | Do not duplicate `role="textbox"` on host |
| **Toggle / checkbox / switch** | Prefer **native** `<input type="checkbox">` inside shadow; host exposes labelled-by | `delegatesFocus` or host per APG | N/A | Validity on allowlisted internals when enabled |
| **Static / meter / progress** | **Host** carries role when no inner native equivalent | Host focusable when interactive | N/A | See meter a11y analysis pattern |
| **Field group / tags** | **Host** `role="group"`; items keep own roles | Container not in tab order unless roving pattern | N/A | Label group via light DOM or shadow per Q3 |

**PoC detail:** The combobox host owns keyboard handling, `aria-expanded`, and `aria-activedescendant`. The trigger is not a separate tab stop; it is the visual focus target when the host is focused.

---

## Q3 — IDREF strategy (label, help, error)

### Recommendation: **Split-surface element references + slotted light composition**

Implement a shared **`syncAriaElementRefs(host, internals, …)`** (see [`combobox-base.js`](./combobox-aria-element-refs/combobox-base.js)) that **partitions targets by tree root**:

```
Light DOM label/help/error  →  host.ariaLabelledByElements / host.ariaDescribedByElements
                              (fallback: aria-labelledby / aria-describedby IDs)

Shadow DOM label/help/error →  internals.ariaLabelledByElements / internals.ariaDescribedByElements

Shadow popup / listbox      →  internals.ariaControlsElements

Slotted light options/items →  host aria-activedescendant="option-id"
                              (ID attribute, not ariaActiveDescendantElement)
```

**Label / help model (2nd-gen)**

- **Default Spectrum composition:** label and help can live in **shadow** (field component owns `<sp-field-label>`-equivalent markup) *or* **light DOM** (consumer supplies `<label>` + help nodes) — both are first-class; see three PoC variants (shadow / light / mixed).
- **Mixin direction:** Evolve 1st-gen `ManageHelpText` into a 2nd-gen **FormFieldAriaMixin** that:
  - calls `attachInternals()` once;
  - registers label/help/error elements on connect;
  - re-syncs on slotchange / invalid toggles;
  - exposes the same slots (`help-text`, `negative-help-text`) for light-DOM override.
- **Cross-root mitigation:** Never rely on shadow-only IDs for `aria-controls`, `aria-labelledby`, or `aria-describedby` on the host — they do not resolve across roots. Element refs on the correct surface (host vs internals) replace IDREF for modern browsers; ID fallback remains for light-only refs when element refs are unavailable.
- **`aria-errormessage`:** Same split as help — shadow error node → `internals.ariaErrorMessageElements`; light error node → host (or attribute fallback). Wire when `invalid` is true.

**Slotted listbox options (combobox / picker):** Keep option nodes in **Light DOM** (`<li slot="option">`) assigned into a shadow `<ul role="listbox">`. This preserves document-scoped IDs for `aria-activedescendant` on the host — validated in PoC.

---

## Q4 — axe-core policy

### Recommendation: **Documented story-level exclusions + upstream tracking**

Align with [`2nd-gen/packages/swc/.storybook/test-runner.ts`](https://github.com/adobe/spectrum-web-components/blob/main/2nd-gen/packages/swc/.storybook/test-runner.ts):

| Mechanism | When to use |
| --------- | ----------- |
| `parameters.a11y.disabledRules` | Rule is globally noisy for web components **and** tracked upstream |
| `parameters.a11y.exclude[ruleId]` | Specific selector is a **known false positive** with written rationale in story/docs |
| Manual / AT checks in migration Phase 4 | Relationship wiring via `ElementInternals` or slotted IDREF |

**Known gaps (Q2–Q3 2026 window — Deque / browser roadmap)**

- axe does **not** fully validate **ElementInternals**-mediated relationships (controls, labelledby, describedby, errormessage).
- **Invalid role via internals** and some **form-associated** scenarios may not fail or pass correctly in CI — do not treat green axe as proof for those cases.
- **Direct element refs** on the host work for **light → host** targets only; do not add CI rules that assume host → shadow refs.

**Contribution path when axe flags a real issue:** fix in component if valid → else story exclusion with comment linking GitHub issue → open/contribute upstream axe rule or [accname / aria reflection](https://w3c.github.io/aria/) spec issue if platform bug.

**Policy:** No permanent global disable of `aria-*` rules for form fields. Exclusions must name the rule, selector, PoC/Epic link, and removal condition.

---

## Component decision table (short form)

| Component class | Role placement | Internals | IDREF / composition | axe note |
| --------------- | -------------- | --------- | ------------------- | -------- |
| Combobox / Picker | Host combobox | `ariaControlsElements` → shadow listbox | Light options slotted; label/help split host/internals; `aria-activedescendant` on host | Exclude only documented internals false positives; AT test popup |
| Textfield / Textarea | Inner native input | Allowlist: form value + validity when SWC-48 ships | Internal `aria-describedby` to shadow help id; light label via `for` + delegatesFocus | Standard input rules; no host combobox rules |
| Checkbox / Switch | Inner native or host per APG | Allowlist optional | Light label `for` → host with reference target when available | |
| Field group | Host `group` | Rare | Light legend / aria-labelledby on host | |
| Button (field adjacent) | Inner `<button>` | Not form field | Light aria-labelledby deferred same as SWC button RFC | |

_Full per-component rows live in migration a11y analyses; extend this table when new classes ship._

---

## Proposed shared implementation (future PR — out of scope here)

Extract from PoC into `@spectrum-web-components/core` (names illustrative):

1. **`FormFieldElement`** — `attachInternals()`, `syncAriaElementRefs()`, slot watchers  
2. **`FormFieldAriaController`** — invalid/help/error sync, active-descendant helper for listbox patterns  
3. **Story helper** — `logAriaRefs` debug panel pattern for Storybook a11y reviews  

Consumers keep composing `<label>` + `<swc-*>` + help in light DOM **or** use bundled shadow label/help without changing ARIA behavior.

---

## Review checklist

### Acceptance (team process)

- [ ] **SWC maintainer** sign-off (review approval or comment)
- [ ] **A11y stakeholder** sign-off (review approval or comment)
- [ ] PoC links verified open: [demos](./combobox-aria-element-refs/), [CodePen](https://codepen.io/spectrum-css/pen/pvNEVda?editors=0010), [StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos/tree/main/combobox-aria-element-refs)
- [ ] Epic / Miro board linked from SWC PR description
- [ ] Jira Epic summary updated with Q1–Q4 table (short form); this README remains canonical detail

### Sign-off log

| Reviewer | Role | Date | Status |
| -------- | ---- | ---- | ------ |
| _name_ | SWC maintainer | | Pending |
| _name_ | A11y stakeholder | | Pending |

---

## Running the PoC

```bash
cd combobox-aria-element-refs
npm install
npm start
```

Open `http://localhost:8080/index.html` and walk through **shadow**, **light**, and **mixed** label/help variants. Each page logs resolved host vs `internals` references and `aria-activedescendant` while interacting.

---

## References

- [ElementInternals.ariaControlsElements (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements)
- [Reflected element references (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
- [Shadow DOM and accessibility (Nolan Lawson)](https://nolanlawson.com/2022/11/28/shadow-dom-and-accessibility-the-trouble-with-aria/)
- [1st-gen ManageHelpText pattern](https://github.com/adobe/spectrum-web-components/blob/main/1st-gen/packages/help-text/help-text-mixin.md)
