# Form fields strategy demos

Live examples and a reference implementation for building accessible, form-associated web components where the **ARIA role lives inside the shadow DOM**.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

---

## Contents

- [Component ARIA roles](#component-aria-roles)
  - [Place roles in the shadow DOM](#place-roles-in-the-shadow-dom)
  - [Why not on the host?](#why-not-on-the-host)
- [IDREF Strategy](#idref-strategy)
  - [1. Shadow DOM slots (default)](#1-shadow-dom-slots-default)
  - [2. Light DOM siblings via `labelledby` / `describedby` properties](#2-light-dom-siblings-via-labelledby--describedby-properties)
  - [Combining both sources for description](#combining-both-sources-for-description)
  - [The `LabellingController`](#the-labellingcontroller)
    - [What it does](#what-it-does)
    - [Exports](#exports)
  - [When `referenceTarget` ships unflagged](#when-referencetarget-ships-unflagged)
- [Form association](#form-association)
  - [How form association works today](#how-form-association-works-today)
  - [Platform-Provided Behaviors](#platform-provided-behaviors)
    - [What `HTMLSubmitButtonBehavior` provides](#what-htmlsubmitbuttonbehavior-provides)
    - [Browser signals (mid-2026)](#browser-signals-mid-2026)
    - [Command invocation — `commandfor` / `command`](#command-invocation--commandfor--command)
    - [Open design questions](#open-design-questions)
  - [The controllers: shims until Platform-Provided Behaviors ship](#the-controllers-shims-until-platform-provided-behaviors-ship)
    - [`FieldAssociationController`](#fieldassociationcontroller)
    - [`ButtonAssociationController`](#buttonassociationcontroller)
  - [When controllers are no longer needed](#when-controllers-are-no-longer-needed)
    - [Migrating from `FieldAssociationController`](#migrating-from-fieldassociationcontroller)
    - [Migrating from `ButtonAssociationController`](#migrating-from-buttonassociationcontroller)
  - [Future directions: beyond submit](#future-directions-beyond-submit)
- [axe-core policy and ElementInternals](#axe-core-policy-and-elementinternals)
  - [Known false positives](#known-false-positives)
  - [Known blind spots (false negatives)](#known-blind-spots-false-negatives)
  - [What to do until Deque resolves these](#what-to-do-until-deque-resolves-these)
- [Platform API support](#platform-api-support)
  - [`ariaLabelledByElements` / `ariaDescribedByElements`](#arialabelledbyelements--ariadescribedbyelements)
  - [`ariaControlsElements`](#ariacontrolselements)
  - [`ariaActiveDescendantElement`](#ariaactivedescendantelement)
  - [`referenceTarget`](#referencetarget)
  - [`referenceTargetMap`](#referencetargetmap)
  - [Platform-Provided Behaviors (`HTMLSubmitButtonBehavior`)](#platform-provided-behaviors-htmlsubmitbuttonbehavior)
- [Component authoring](#component-authoring)
  - [1. Shadow DOM structure](#1-shadow-dom-structure)
  - [2. Component class](#2-component-class)
  - [3. Adding form association](#3-adding-form-association)
  - [4. Combobox extras](#4-combobox-extras)
  - [Rules for component authors](#rules-for-component-authors)
- [Consumer usage examples](#consumer-usage-examples)
  - [Slotted label and description](#slotted-label-and-description)
  - [Light DOM siblings via `labelledby` / `describedby`](#light-dom-siblings-via-labelledby--describedby)
  - [Setting properties in JavaScript](#setting-properties-in-javascript)
  - [Both sources together](#both-sources-together)
- [Demos](#demos)
- [Run locally](#run-locally)
- [Further reading](#further-reading)
- [References](#references)

---

## Component ARIA roles

### Place roles in the shadow DOM

Place the ARIA role on an **inner shadow DOM element** — not on the custom element host.

- For **textfield** and **checkbox**, use a native `<input>`. The browser supplies the role, focus behavior, and keyboard semantics automatically.
- For **progressbar**, **combobox**, and other non-native roles, use a `<div role="...">` inside the shadow root.


| Control class | Role placement |
|---------------|---------------|
| Text input, search, email, etc. | Shadow `<input type="text">` — role is native |
| Checkbox, radio | Shadow `<input type="checkbox">` — role is native |
| Progressbar, meter | Shadow `<div role="progressbar">` |
| Combobox / listbox | Shadow `<div role="combobox">` + shadow `<ul role="listbox">` |

The host element carries no role. This is intentional — it lets the shadow DOM own the element's semantics, its label/help text, and all associated CSS as a single encapsulated unit.

### Why not on the host?

Keeping the role on an inner shadow DOM element has two key advantages:

**CSS encapsulation.** The shadow DOM label span, help text span, input element, and all focus/hover/error states can be styled with ordinary shadow-root CSS. The consumer never needs to pierce the shadow with `::part()` or custom properties just to change label font-size or help text color — those styles live inside the component where they belong.

**Simpler ARIA wiring.** When the role element is inside the shadow root, `aria-labelledby` and `aria-describedby` can reference the shadow label and description spans by their same-root IDs — a straightforward, well-supported mechanism. If the role were on the host, you would need `ElementInternals` to set ARIA, and the browser/axe/AT inconsistencies around that API become your problem.

```html
<!-- textfield — native role, same-root label/description wiring -->
<span id="label" class="field-label" hidden><slot name="label"></slot></span>
<input id="role" type="text" aria-labelledby="label" aria-describedby="description" />
<span id="description" class="field-help" hidden><slot name="description"></slot></span>

<!-- combobox — explicit role, same pattern -->
<span id="label" class="field-label" hidden><slot name="label"></slot></span>
<div id="role" role="combobox" aria-labelledby="label" aria-describedby="description"
     aria-controls="listbox" aria-expanded="false" tabindex="0"></div>
<span id="description" class="field-help" hidden><slot name="description"></slot></span>
```

Use `delegatesFocus: true` when attaching the shadow root so a single tab stop on the host delegates focus to the inner role element automatically:

```js
this.attachShadow({ mode: 'open', delegatesFocus: true });
```

---

## IDREF Strategy

Two sources of label and description text are supported and can be combined. **We recommend the hybrid approach** — shadow DOM slots for the common case, light DOM element refs for contextual overrides — so that consumers can always use whichever fits their page structure.

A standalone form field can be labeled with a slotted `<span slot="label">`. That same component dropped into a data grid cell should be labeled by the column and row headers — elements already in the light DOM. A ZIP code field in a multi-address form might share a footnote description with several other fields. In all of these cases the component doesn't change; the consumer chooses which wiring to use.

**Common scenarios that require light DOM labelling:**

- **Data grids** — each cell contains an editable field labeled by the column header (`<th>`) and identified by the row header. Slotting a separate label into every cell would duplicate content already present in the table structure.
- **Multi-section forms** (e.g. billing + shipping addresses) — fields in each section may be labeled by a shared `<h2>` section heading and described by a single footnote or legal notice at the bottom of the form that applies to several fields at once.
- **Inline editing** — a field replaces static display text on activation; the surrounding text or heading already describes the field; no separate label element is added.
- **Shared validation messages** — a `role="alert"` paragraph below a fieldset describes the error state for multiple fields simultaneously.

**Recommendation: hybrid — shadow DOM slots for default label/help, element ref properties for cross-root wiring.**

| Scenario | Mechanism |
|----------|-----------|
| Label/help text supplied by the consumer as slotted children | `<slot name="label">` / `<slot name="description">` → same-root `aria-labelledby`/`aria-describedby` attribute on the inner role element |
| Label/help text lives elsewhere in the light DOM (table headers, section headings, shared footnotes) | `labelledby` / `describedby` properties → `ariaLabelledByElements` / `ariaDescribedByElements` cross-root element refs on the inner role element |
| Both present simultaneously | Both sources are merged; shadow description span comes first |

Never use `aria-labelledby` attribute to point at a light DOM ID from inside a shadow root — ID references do not cross shadow root boundaries.

### 1. Shadow DOM slots (default)

Each component exposes two **named slots** that project label and description text into the shadow DOM:

| Slot | Purpose |
|------|---------|
| `slot="label"` | Text rendered inside the shadow label span |
| `slot="description"` | Text rendered inside the shadow description span |

The shadow DOM structure:

```html
<span id="label" class="field-label" hidden>
    <slot name="label"></slot>
</span>

<input id="role" type="text" />

<span id="description" class="field-help" hidden>
    <slot name="description"></slot>
</span>
```

The spans start `hidden`. The `LabellingController` shows them only when slot content is present, and wires the role element using same-root `aria-labelledby="label"` / `aria-describedby="description"` — which work reliably within a single shadow root.

**Consumer usage:**

```html
<my-textfield>
    <span slot="label">Email address</span>
    <span slot="description">We'll never share your email.</span>
</my-textfield>
```

### 2. Light DOM siblings via `labelledby` / `describedby` properties

For cases where the label and description live as **plain siblings** on the page, each component exposes two JS properties (also reflected as HTML attributes):

| Property / attribute | Accepts | Effect |
|----------------------|---------|--------|
| `labelledby` | Space-separated element IDs | Resolves those IDs in the document and sets `ariaLabelledByElements` on the inner role element |
| `describedby` | Space-separated element IDs | Same, sets `ariaDescribedByElements` |

These use the [element reference API](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements) (`ariaLabelledByElements` / `ariaDescribedByElements`), which works **cross-root** — a shadow element can reference a light DOM element as its label source.

**Data grid — labeled by column and row headers:**

```html
<table>
    <thead>
        <tr>
            <th id="name-col">Name</th>
            <th id="email-col">Email</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th id="row-1" scope="row">Row 1</th>
            <td>
                <my-textfield
                    labelledby="name-col row-1"
                ></my-textfield>
            </td>
            <td>
                <my-textfield
                    labelledby="email-col row-1"
                    describedby="email-note"
                ></my-textfield>
            </td>
        </tr>
    </tbody>
</table>
<p id="email-note">Used for order confirmations only.</p>
```

The `labelledby="name-col row-1"` value mirrors how native table cells are announced — the field's accessible name is computed from both the column and row header text. No `<span slot="label">` is added to any cell; the table structure already carries the labelling.

**Multi-section form — labeled by section headings, shared footnote description:**

```html
<section aria-labelledby="billing-heading">
    <h2 id="billing-heading">Billing address</h2>

    <my-textfield labelledby="billing-heading street-label">
        <span slot="label" id="street-label">Street</span>
    </my-textfield>

    <my-textfield
        labelledby="billing-heading zip-label"
        describedby="zip-note"
    >
        <span slot="label" id="zip-label">ZIP code</span>
    </my-textfield>
</section>

<section aria-labelledby="shipping-heading">
    <h2 id="shipping-heading">Shipping address</h2>

    <my-textfield
        labelledby="shipping-heading zip-label-2"
        describedby="zip-note"
    >
        <span slot="label" id="zip-label-2">ZIP code</span>
    </my-textfield>
</section>

<p id="zip-note">5-digit US ZIP or 9-digit ZIP+4 (e.g. 94105-1804).</p>
```

Both ZIP fields reference the same `#zip-note` footnote via `describedby`. The `labelledby` value includes both the section heading and the field's own label slot, so a screen reader announces "Billing address — ZIP code" and "Shipping address — ZIP code" respectively, disambiguating identically-named fields in the same form.

**Inline editing — no separate label element:**

```html
<h2 id="product-name">Acme Widget Pro</h2>
<button id="edit-btn" aria-controls="name-field">Edit</button>

<!-- Field replaces the heading text on activation -->
<my-textfield
    id="name-field"
    labelledby="product-name"
    hidden
></my-textfield>
```

Or set the properties directly in JavaScript when IDs are generated at runtime:

```js
const field = document.querySelector('my-textfield');
field.labelledby  = columnHeader.id;
field.describedby = sharedNote.id;
```

### Combining both sources for description

When `describedby` is set **and** slotted description content is present, the controller includes **both** in `ariaDescribedByElements` — the shadow description span comes first, followed by the resolved light DOM elements. This allows a component to provide built-in contextual help while still accepting supplementary validation errors from the page:

```html
<my-textfield describedby="global-error">
    <span slot="label">Email address</span>
    <span slot="description">We'll never share your email.</span>
</my-textfield>
<p id="global-error" role="alert">This field is required.</p>
```

### The `LabellingController`

[`labelling-controller.js`](./labelling-controller.js) is a plain JavaScript controller (no framework required) that encapsulates all labelling logic so it does not have to be duplicated across components.

#### What it does

- **Watches `slot[name="label"]` and `slot[name="description"]`** via `slotchange` and re-wires ARIA whenever content is added or removed.
- **Shows or hides the shadow label/description spans** depending on whether their slot has content.
- **Sets `ariaLabelledByElements`** on the inner role element, pointing at the shadow label span when slotted, or at resolved light DOM elements when not.
- **Sets `ariaDescribedByElements`** combining both shadow and light DOM sources when both are present.
- **Falls back gracefully** when `ariaLabelledByElements` is not supported: same-root `aria-labelledby` attribute is used for slotted content; `aria-label` / `aria-description` text-mirroring is used for light DOM siblings.
- **Calls `onUpdate()`** after every re-wire so the host component can refresh its debug panel or any other derived state.

#### Exports

| Export | Purpose |
|--------|---------|
| `LabellingController` | The controller class |
| `LABELLING_DEBUG_HTML` | A `<dt>`/`<dd>` HTML snippet to paste into a shadow debug panel |
| `applyLabellingDebug(shadowRoot, info)` | Writes `controller.debugInfo` into those debug rows |

---

### When `referenceTarget` ships unflagged

[`referenceTarget`](#referencetarget) is currently behind flags in all three major browsers. Once it ships unflagged and reaches your supported browser range, **the light DOM sibling path (Section 2 above) can be deleted** from most field components. Here is a precise accounting of what changes and what does not.

#### What becomes unnecessary

| Current mechanism | Why it exists | Once `referenceTarget` ships |
|-------------------|---------------|------------------------------|
| `labelledby` / `describedby` attributes and JS properties | Let consumers wire external label/description IDs cross-root by passing them into the component | Consumers write `aria-labelledby="my-textfield"` directly on the host; `referenceTarget` routes it to the inner role element — no component API needed |
| `ariaLabelledByElements` / `ariaDescribedByElements` wiring in `LabellingController` | Perform the cross-root element reference the browser cannot do with ID strings | Browser resolves the ID through `referenceTarget` natively |
| `resolveIds()` utility and `SUPPORTS_ELEMENT_REFS` branch | Polyfill `ariaLabelledByElements` absence; resolve string IDs to elements | No longer called for the external-label path |
| `attributeChangedCallback` handling for `labelledby` / `describedby` | Sync attribute → property → `ariaLabelledByElements` | Property and attribute can be removed from `observedAttributes` |

For a simple textfield or checkbox, `referenceTarget` set on the shadow root to the inner `<input>` is sufficient: both `aria-labelledby` and `aria-describedby` from external consumers resolve to the `<input>`, which is already the correct labelling target.

Migration for a textfield would look like this:

```js
// Before: consumer must use the component's custom property
// <my-textfield labelledby="col-header"></my-textfield>

// After: consumer uses the standard attribute on the host
// <my-textfield aria-labelledby="col-header"></my-textfield>

connectedCallback() {
    this.attachShadow({ mode: 'open' });
    // Declare the inner <input> as the canonical IDREF target
    this.shadowRoot.referenceTarget = 'role'; // 'role' is the id of the inner <input>
    this.shadowRoot.innerHTML = `...`;
    // LabellingController still needed for the slotted label path;
    // light DOM sibling wiring logic can be removed.
}
```

#### What remains necessary

`referenceTarget` resolves IDREFs that *enter* a shadow host from outside. It does not help with ARIA relationship attributes that go *from a shadow element to a light DOM element*, or with native `<label>` interaction. The following areas are unaffected.

**Slotted label and description path.** Same-root `aria-labelledby="label"` / `aria-describedby="description"` inside the shadow, managed by the slots-and-spans structure, already works without any cross-root element refs. `referenceTarget` neither helps nor harms it. The `LabellingController`'s `slotchange` listener, show/hide logic, and same-root ID wiring remain exactly as-is.

**`<label for>` click-to-focus.** `referenceTarget` handles ARIA IDREF resolution but not the native `<label>` click association. Clicking a `<label for="my-textfield">` still does not focus the inner `<input>` — that requires either a hidden native input, a future label behavior (see [Beyond submit: a future label behavior](#beyond-submit-a-future-label-behavior-and-referencetarget)), or `delegatesFocus: true` as a partial mitigation.

**`referenceTargetMap` gap.** `referenceTarget` sets a single canonical inner element for *all* IDREF attributes. For most field components this is fine — both `aria-labelledby` and `aria-describedby` should resolve to the `<input>`. If a future component needs different targets per attribute (e.g., `aria-labelledby` → `<input>`, `aria-describedby` → a separate help span), `referenceTargetMap` would be needed. That spec is still at proposal stage with no browser support.

**Combobox — several wiring paths remain complex.** The combobox is the most involved case because it manages multiple ARIA relationships simultaneously, some of which cross root boundaries in both directions:

| Relationship | Direction | `referenceTarget` helps? | Current approach | Remains after `referenceTarget` |
|---|---|---|---|---|
| Label → trigger | External → shadow | ✅ Yes | `labelledby` prop → `ariaLabelledByElements` | Delete property; set `referenceTarget = 'role'` |
| `aria-controls` (trigger → listbox) | Shadow → shadow | N/A — same root | Same-root attribute | Unchanged |
| `aria-expanded` | State on trigger | N/A | Managed in JS | Unchanged |
| `aria-activedescendant` (trigger → active option) | Shadow → light DOM | ❌ No | `ariaActiveDescendantElement` cross-root element ref (with ID fallback) | Still required — `referenceTarget` only affects inbound IDREF resolution, not outbound element relationships |
| `aria-selected` on slotted options | Light DOM elements | N/A | Set by component JS | Unchanged |

The `aria-activedescendant` / `ariaActiveDescendantElement` wiring — where the shadow-root trigger element must point at the currently-active slotted option in the light DOM — is not addressed by `referenceTarget` at all. The cross-root element reference property remains the right tool there, and the full `ariaActiveDescendantElement`-with-id-fallback pattern documented in [Combobox extras](#4-combobox-extras) stays in place.

---

## Form association

Custom elements participate in `<form>` submission and reset through two complementary mechanisms: the `ElementInternals` API available in all modern browsers today, and the Platform-Provided Behaviors proposal working through the standards process. The two controllers in this repo bridge the gap — they encapsulate what must be wired manually today and each has a clear exit path once behaviors ship.

---

### How form association works today

The [ElementInternals API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals) is the foundation for custom element form participation. The approach differs by component type.

**For field components** (textfields, checkboxes, comboboxes — anything that holds a value):

1. Declare `static formAssociated = true` on the class.
2. Call `attachInternals()` to get an `ElementInternals` instance.
3. Call `internals.setFormValue(val)` whenever the field's value changes.
4. Implement `formResetCallback()` to restore the field to its default state.

**For button components:**

A shadow DOM `<button type="submit">` does **not** auto-submit the form containing the custom element host — the browser's default submit behavior is scoped to the shadow root. The correct pattern today is to use `static formAssociated = true`, obtain `internals.form`, and call `internals.form.requestSubmit()` / `.reset()` manually on activation.

| Topic | Guidance |
|-------|----------|
| Browser support | Chromium 77+, Safari 16.4+, Firefox 93+. Well-supported in modern targets. |
| AT exposure | Most screen readers read ARIA set via `ElementInternals` in Chromium and Safari. Firefox AT exposure is less consistent; verify with real devices. |
| axe-core | Axe-core has gaps — see [axe-core policy and ElementInternals](#axe-core-policy-and-elementinternals). Several rules produce false positives or blind spots today. |
| Field vs. button | Use `formAssociated` for fields that hold values. Buttons use it only to obtain `internals.form` — see [The controllers](#the-controllers-shims-until-platform-provided-behaviors-ship) below. |

---

### Platform-Provided Behaviors

> **Tracking:** [WHATWG html#12150](https://github.com/whatwg/html/issues/12150) · Stage 1 (Incubation) · Spec PR [html#12409](https://github.com/whatwg/html/pull/12409)
> **Origin:** [MSEdge explainer — ElementInternalsType](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ElementInternalsType/explainer.md)
> **Blink-dev intents:** [Intent to Prototype](http://www.mail-archive.com/blink-dev@chromium.org/msg15958.html) · [Intent to Ship](http://www.mail-archive.com/blink-dev@chromium.org/msg16533.html)
> **W3C public-html thread:** [lists.w3.org/Archives/Public/public-html/2026Jun/0001](https://lists.w3.org/Archives/Public/public-html/2026Jun/0001.html)

**Platform-Provided Behaviors** introduces a `behaviors` option to `attachInternals()`, allowing custom elements to adopt native browser capabilities without extending native elements or reimplementing complex logic:

```js
class MyButton extends HTMLElement {
    #submitBehavior = new HTMLSubmitButtonBehavior();
    #internals = this.attachInternals({ behaviors: [this.#submitBehavior] });
}
```

This is consistent with the web platform's existing constructable-object pattern (e.g. `ResizeObserver`, `IntersectionObserver`) and aligns with W3C design principles.

The initial behavior being standardized is **`HTMLSubmitButtonBehavior`**, which closes two gaps that manual `ElementInternals` wiring cannot fill:

- **Implicit form submission** — pressing Enter in a text field activates the form's default submit button, a platform-level action no JS click handler can intercept.
- **`:default` CSS pseudo-class** — marks the default submit button in a form; `ElementInternals` has no way to claim it.

#### What `HTMLSubmitButtonBehavior` provides

| Capability | Description |
|------------|-------------|
| User activation | Click, Enter, Space, and implicit submission (Enter in a text field) |
| Default ARIA role | `button` — overridable via `internals.role` or the `role` attribute |
| Focus participation | Sequential focus navigation; no manual `tabindex` needed |
| CSS pseudo-classes | `:default`, `:disabled`, `:enabled`, `:focus`, `:focus-visible` |
| Mirrored properties | `disabled`, `form`, `formAction`, `formEnctype`, `formMethod`, `formNoValidate`, `formTarget`, `labels`, `name`, `value` — identical surface to `HTMLButtonElement` |
| Form ownership | Full submitter-eligibility integration |

Behaviors are **immutable once attached** but remain internally mutable (e.g. `disabled` state can change). Subclassing is disallowed — `new class extends HTMLSubmitButtonBehavior {}` throws a `TypeError`.

#### Browser signals (mid-2026)

| Browser | Status |
|---------|--------|
| Chromium / Edge | Implementing — driving the proposal |
| WebKit / Safari | Standards position filed; pending |
| Gecko / Firefox | Standards position filed; pending |

#### Command invocation — `commandfor` / `command`

The same explainer describes a **command invocation** model separate from form submission. Using `commandfor` and `command` attributes, any button-like element can invoke built-in actions on a target element:

```html
<my-button commandfor="my-dialog" command="show-modal">Open</my-button>
<my-button commandfor="my-popover" command="toggle-popover">Toggle</my-button>
```

This involves `ElementInternals.commandForElement`, `ElementInternals.command`, and a `CommandEvent` fired on the target. The WHATWG spec PR covers the `HTMLSubmitButtonBehavior` path; command invocation is a related but distinct surface.

#### Open design questions

- **Behavior identification (keithamus):** Accessing a specific behavior from `ElementInternals` requires `instanceof` checks against the behavior array — awkward and order-dependent. The community has flagged this as an ergonomics gap.
- **TypeScript experience (trusktr):** Statically typed consumers cannot easily discover which behaviors are attached without runtime checks. The typed surface of `behaviors: [...]` is an open question.

#### Alternatives considered

- **Feature decomposition** — command invocation only, no implicit behaviors
- **`behavesLike` property** — broader behavior matching (button, label, …)
- **`elementInternals.type`** — runtime-settable type property
- **Customized built-ins** — the `extends`/`is` path, closed off by Safari's refusal to ship it

---

### The controllers: shims until Platform-Provided Behaviors ship

This repo provides two controllers that encapsulate what must be wired manually today. Both are interim patterns with clear exit paths.

| Controller | Component type | Superseded by | Status |
|---|---|---|---|
| `FieldAssociationController` | Field (textfield, checkbox, combobox) | A future field behavior (not yet proposed) | Use today; no near-term replacement |
| `ButtonAssociationController` | Button | `HTMLSubmitButtonBehavior` | Use today; WHATWG Stage 1, migrate per-component when broadly available |

#### `FieldAssociationController`

[`field-association-controller.js`](./field-association-controller.js) encapsulates the `ElementInternals` API surface shared by all form-associated **field** components so this logic is not duplicated across textfield, checkbox, combobox, and similar elements.

The host element must still declare `static formAssociated = true` and call `attachInternals()` — these cannot be delegated. The controller receives the resulting `ElementInternals` object and wraps it.

**What it does:**

- **`setValue(val)`** — Calls `internals.setFormValue(val)`. Pass `null` to exclude the field from `FormData` (unchecked checkbox, disabled field, unselected combobox).
- **`defaultValue`** — Get/set the value the field restores to on `formResetCallback`. Populated from the `value` attribute.
- **`form`, `validity`, `validationMessage`, `willValidate`** — Pass-through getters.
- **`checkValidity()` / `reportValidity()`** — Pass-through methods.

**Usage example:**

```js
import { FieldAssociationController } from './field-association-controller.js';

class MyTextfield extends HTMLElement {
    static formAssociated = true;
    #internals  = this.attachInternals();
    #fieldAssoc = new FieldAssociationController(this.#internals);
    #inputEl    = null;

    static get observedAttributes() {
        return ['labelledby', 'describedby', 'value', 'disabled', 'required'];
    }

    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
        if (name === 'value')    { this.#fieldAssoc.defaultValue = val ?? ''; this.#syncValue(); }
        if (name === 'disabled') this.#syncDisabled();
        if (name === 'required') this.#syncRequired();
    }

    get value() { return this.#inputEl?.value ?? ''; }
    set value(val) {
        if (this.#inputEl) this.#inputEl.value = val ?? '';
        this.#fieldAssoc.setValue(val ?? '');
    }

    get form()              { return this.#fieldAssoc.form; }
    get validity()          { return this.#fieldAssoc.validity; }
    get validationMessage() { return this.#fieldAssoc.validationMessage; }
    get willValidate()      { return this.#fieldAssoc.willValidate; }
    checkValidity()         { return this.#fieldAssoc.checkValidity(); }
    reportValidity()        { return this.#fieldAssoc.reportValidity(); }

    formResetCallback() { this.value = this.#fieldAssoc.defaultValue; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `/* shadow template */`;
        this.#inputEl = this.shadowRoot.querySelector('#role');
        this.#fieldAssoc.setValue(this.#fieldAssoc.defaultValue);
        this.#inputEl.addEventListener('input', () => {
            this.#fieldAssoc.setValue(this.#inputEl.value);
        });
        this.#labelling.connect(this.shadowRoot);
    }

    #syncDisabled() {
        if (this.#inputEl) this.#inputEl.disabled = this.hasAttribute('disabled');
        this.#fieldAssoc.setValue(
            this.hasAttribute('disabled') ? null : (this.#inputEl?.value ?? '')
        );
    }
}
```

**Checkbox pattern** — exclude unchecked and disabled fields from `FormData`, mirroring native behavior:

```js
#updateFormValue() {
    this.#fieldAssoc.setValue(
        (this.#inputEl?.checked && !this.hasAttribute('disabled'))
            ? (this.getAttribute('value') ?? 'on')
            : null
    );
}
```

**Combobox pattern** — submit the selected option's `value` attribute, falling back to its text content:

```js
#selectOption(index) {
    const opt = this.#options[index];
    opt.setAttribute('aria-selected', 'true');
    const formValue = opt.getAttribute('value') ?? opt.textContent.trim();
    this.#fieldAssoc.setValue(this.hasAttribute('disabled') ? null : formValue);
}

formResetCallback() {
    this.#options.forEach(o => o.setAttribute('aria-selected', 'false'));
    this.#valueEl.textContent = 'Select an option';
    this.#fieldAssoc.setValue(null);
}
```

#### `ButtonAssociationController`

[`button-association-controller.js`](./button-association-controller.js) polyfills the button activation behaviors reachable from JS — keyboard activation, ARIA role, focusability, and `commandfor`/`command` dispatch — while the spec works through the standards process.

**What it polyfills:**

| Behavior | How |
|----------|-----|
| Native detection | Checks `'commandForElement' in ElementInternals.prototype`; no-ops entirely when native support is present |
| Focusability | Sets `tabindex="0"` on `connect()` if the author has not already set one |
| ARIA role | Sets `ElementInternals.role = 'button'` if not overridden by author |
| Keyboard activation | `keydown` listener: Enter / Space → `host.click()` |
| Command dispatch | `click` listener → `CommandEvent` on the `commandfor` target → built-in action if not cancelled |
| `commandfor` / `command` observation | `MutationObserver` — no `observedAttributes` changes on the host required |
| `aria-disabled` + tab removal | Synced from `disabled` attribute |
| `CommandEvent` shim | Installs a minimal `CommandEvent` class on `globalThis` when absent |

Built-in `command` values: `show-modal`, `close`, `toggle-popover`, `show-popover`, `hide-popover`, `request-submit`, `reset`.

**What it cannot polyfill** — two behaviors require platform cooperation:

| Behavior | Why |
|----------|-----|
| **Implicit form submission** | Enter in a text field activates the default submit button before any JS event fires; there is no way to claim that role from script. |
| **`:default` pseudo-class** | Set by the browser as part of form-control infrastructure; `ElementInternals` does not expose a way to claim it. |

**Usage example:**

```js
import { ButtonAssociationController } from './button-association-controller.js';

class MyButton extends HTMLElement {
    static formAssociated = true;
    #internals = this.attachInternals();
    #button    = new ButtonAssociationController(this, this.#internals);

    get type() { return this.getAttribute('type') ?? 'submit'; }
    get form()  { return this.#internals.form; }

    connectedCallback() {
        this.attachShadow({ mode: 'open', delegatesFocus: true });
        this.shadowRoot.innerHTML = `<slot>Button</slot>`;
        this.#button.connect();
        // Form submit/reset — wired manually today; HTMLSubmitButtonBehavior
        // will handle this once broadly available.
        this.addEventListener('click', () => {
            if (this.hasAttribute('disabled')) return;
            if (this.type === 'submit') this.#internals.form?.requestSubmit();
            if (this.type === 'reset')  this.#internals.form?.reset();
        });
    }

    disconnectedCallback() { this.#button.disconnect(); }

    get commandForElement() { return this.#button.commandForElement; }
    get command()           { return this.#button.command; }
}
customElements.define('my-button', MyButton);
```

```html
<!-- Dialog -->
<my-button commandfor="confirm-dialog" command="show-modal">Open dialog</my-button>

<!-- Popover -->
<my-button commandfor="tip" command="toggle-popover">Show tip</my-button>
<div id="tip" popover>Tip text.</div>

<!-- Custom command — target handles it, can cancel -->
<my-button commandfor="counter" command="my-increment">+1</my-button>
<script>
document.getElementById('counter').addEventListener('command', e => {
    if (someCondition) e.preventDefault();
    else count++;
});
</script>
```

---

### When controllers are no longer needed

#### Migrating from `FieldAssociationController`

No platform-provided field behavior is currently proposed — `FieldAssociationController` is the correct approach for the foreseeable future. The Platform-Provided Behaviors pattern is explicitly designed to be extensible, so a future `HTMLTextInputBehavior`, `HTMLCheckboxBehavior`, or similar is plausible. If one ships, the migration on a field component would look like this:

**Remove from the element class:**

```js
static formAssociated = true;                                      // remove
#internals  = this.attachInternals();                              // replace (see below)
#fieldAssoc = new FieldAssociationController(this.#internals);     // remove

get form()              { return this.#fieldAssoc.form; }          // remove
get validity()          { return this.#fieldAssoc.validity; }      // remove
get validationMessage() { return this.#fieldAssoc.validationMessage; } // remove
get willValidate()      { return this.#fieldAssoc.willValidate; }  // remove
checkValidity()         { return this.#fieldAssoc.checkValidity(); }   // remove
reportValidity()        { return this.#fieldAssoc.reportValidity(); }  // remove
formResetCallback()     { this.value = this.#fieldAssoc.defaultValue; } // remove
```

**Replace with:**

```js
// Hypothetical — exact API TBD by the spec
#fieldBehavior = new HTMLTextInputBehavior();
#internals = this.attachInternals({ behaviors: [this.#fieldBehavior] });
```

**What stays unchanged:** the `input` event listener, `disabled`/`required` attribute syncing, the shadow DOM structure, and the `LabellingController` wiring. The behavior takes over the `ElementInternals` lifecycle (value reporting, validity, reset) but does not replace the component's own value-reading logic or ARIA management. The `setValue(null)` conditions (unchecked, disabled) remain in the component — only the call site goes away.

#### Migrating from `ButtonAssociationController`

Once `HTMLSubmitButtonBehavior` ships in your supported browser range, three things change:

**1. Replace `attachInternals()` with the behavior constructor:**

```js
// Before
static formAssociated = true;
#internals = this.attachInternals();
#button    = new ButtonAssociationController(this, this.#internals);

// After
#submitBehavior = new HTMLSubmitButtonBehavior();
#internals = this.attachInternals({ behaviors: [this.#submitBehavior] });
```

**2. Delete the click handler and controller lifecycle calls.** `HTMLSubmitButtonBehavior` wires click, Enter, Space, and implicit form submission automatically. Remove `connect()`, `disconnect()`, and the `addEventListener('click', ...)` block.

**3. Remove `static formAssociated = true`.** Form ownership is provided by the behavior. The `get form()` pass-through can also be deleted — use the behavior's mirrored property directly.

Use feature detection to branch during the transition period:

```js
const HAS_SUBMIT_BEHAVIOR = typeof HTMLSubmitButtonBehavior !== 'undefined';

class MyButton extends HTMLElement {
    static formAssociated = !HAS_SUBMIT_BEHAVIOR;

    #submitBehavior = HAS_SUBMIT_BEHAVIOR ? new HTMLSubmitButtonBehavior() : null;
    #internals = HAS_SUBMIT_BEHAVIOR
        ? this.attachInternals({ behaviors: [this.#submitBehavior] })
        : this.attachInternals();
    #button = HAS_SUBMIT_BEHAVIOR ? null : new ButtonAssociationController(this, this.#internals);

    connectedCallback() {
        this.attachShadow({ mode: 'open', delegatesFocus: true });
        this.shadowRoot.innerHTML = `<slot>Button</slot>`;
        this.#button?.connect();
        if (!HAS_SUBMIT_BEHAVIOR) {
            this.addEventListener('click', () => {
                if (this.hasAttribute('disabled')) return;
                if ((this.getAttribute('type') ?? 'submit') === 'submit')
                    this.#internals.form?.requestSubmit();
                else
                    this.#internals.form?.reset();
            });
        }
        // When HAS_SUBMIT_BEHAVIOR is true, activation is wired by the behavior.
    }

    disconnectedCallback() { this.#button?.disconnect(); }
}
```

Once `HAS_SUBMIT_BEHAVIOR` is always `true` in your supported range, delete the entire branch and the `ButtonAssociationController` import.

---

### Future directions: beyond submit

`HTMLSubmitButtonBehavior` is the first behavior in the proposal, but the pattern is designed to be extensible. The most strategically significant next behavior would be something analogous for **label association** — giving a custom element the ability to claim `<label for="...">` wiring and participate in the platform's label-click-to-focus chain without a hidden native input.

This connects directly to [`referenceTarget`](#referencetarget), documented in the Platform API support section below. `referenceTarget` lets a custom element host declare which inner shadow element is the canonical IDREF target, so that `aria-labelledby="my-textfield"` on an external element resolves to the inner `<input>` without JS wiring. All three major browsers have implemented it behind a flag; none have shipped it unflagged yet.

The key question to raise with the platform team: **once `referenceTarget` ships unflagged, does a future label behavior become redundant, complementary, or is it still needed for the `<label for>` click association that `referenceTarget` alone does not cover?**

| Gap | `referenceTarget` | A future label behavior |
|-----|------------------|------------------------|
| `aria-labelledby` from external element resolves to inner input | ✅ Closes | — |
| `<label for="my-element">` click focuses inner input | ❌ Does not help — `for` wiring is separate from IDREF resolution | ✅ Would close |
| `labels` property returns associated `<label>` elements | ❌ Not addressed | ✅ Would mirror `HTMLInputElement.labels` |
| `LabellingController` and `labelledby`/`describedby` become unnecessary | Partially — for the `aria-labelledby` case | More fully — for the click and introspection cases |

The two are complementary, not competing. Track both as browsers move toward shipping `referenceTarget` unflagged.

---


## axe-core policy and ElementInternals

**Recommendation: document exclusions at the story level with rationale; track upstream.**

Deque has been shipping ElementInternals support in tranches (ARIA from internals, cross-root element refs, extension-related behavior — targeted through 2025). axe-core still produces false positives and blind spots for FACE components in many versions. Check the [elementInternals label](https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals) for current status and remove exclusions as fixes land. The correct response is:

1. Exclude affected rules per component story with a `// reason:` comment.
2. Log an upstream issue link alongside each exclusion.
3. Treat screen reader spot-checks as authoritative for these patterns; axe-core is supplementary only.
4. Revisit exclusions each quarter as Deque ships fixes.

Browsers do not expose a single standard path for axe-core to read accessibility data set via `ElementInternals`. Deque is actively working on this under their [elementInternals-labeled issues](https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals), but several gaps remain today (mid-2025).

### Known false positives

| Rule | Symptom | Why it fires |
|------|---------|-------------|
| `label` | "Form element does not have a label" fires on the custom element host | axe-core inspects the host, which has no role and no label; it doesn't look into the shadow root to find the inner `<input>` with its label wired via `ariaLabelledByElements` |
| `aria-required-children` | "Certain ARIA roles must contain particular children" fires on combobox | axe-core does not follow `slot[name="options"]` into the light DOM to find `role="option"` children |
| `duplicate-id-aria` | May fire for shadow DOM IDs (`label`, `description`, `role`) that appear in multiple component instances | Shadow-root IDs are scoped — they cannot conflict — but axe-core may flatten them |

### Known blind spots (false negatives)

| Scenario | Risk |
|----------|------|
| Label missing entirely | axe-core may **not** flag the inner `<input>` as unlabeled because it doesn't know to look for cross-root element refs; a misconfigured `labelledby` prop silently fails |
| `ariaLabelledByElements` targeting a removed element | The element ref becomes stale; axe-core won't detect this but screen readers will announce nothing |

### What to do until Deque resolves these

1. **Exclude affected rules per story, with a rationale comment and upstream issue link:**

    ```js
    // In Storybook test-runner or axe options:
    axe.configure({
        rules: [
            {
                id: 'label',
                // axe-core does not follow ariaLabelledByElements cross-root.
                // Tracked: https://github.com/dequelabs/axe-core/issues/<issue>
                // Remove exclusion once Deque ships direct element ref support.
                selector: 'my-textfield, my-checkbox, my-combobox',
                enabled: false,
            },
        ],
    });
    ```

2. **Treat screen reader spot-checks as authoritative** for labelling and form participation. Run NVDA/Chrome and VoiceOver/Safari against every component archetype at least once per release.

3. **Revisit exclusions quarterly.** Deque's stated goal is to ship internals ARIA reading, direct element refs (`ariaLabelledByElements`), and extension-related behavior in tranches targeting mid–late 2025. Check Deque's release notes and remove exclusions as fixes land.

4. **Document the policy for consumers** who run axe-core in their own test suites. Include language like:

    > These components use `ElementInternals` and cross-root element reference APIs (`ariaLabelledByElements`) for ARIA labelling. axe-core may produce false positives for `label` and `aria-required-children` rules against these elements today. These are known gaps in axe-core's shadow DOM / ElementInternals support. Verify labelling correctness with a screen reader. Track Deque's progress at [dequelabs/axe-core](https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals) and remove any exclusions from your axe config once the relevant fixes ship.

5. **Community references to share with consumers:**
    - [Benny Powers — CEM and ElementInternals](https://bennypowers.dev/posts/let-equals-equal-equals/) — explains element ref silent failure modes
    - [plasticmind — Inside ElementInternals](https://plasticmind.github.io/elementinternals-a11y/) — interactive field manual for FACE patterns
    - Deque `elementInternals` label: `https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals`

---

## Platform API support

The following APIs underpin this approach. Browser support status as of mid-2026:

### `ariaLabelledByElements` / `ariaDescribedByElements`

[Can I use — ariaLabelledByElements](https://caniuse.com/?search=ariaLabelledByElements) · [Can I use — ariaDescribedByElements](https://caniuse.com/?search=ariaDescribedByElements)

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ 135+ |
| Safari | ✅ 16.4+ |
| Firefox | ✅ 136+ |

**Current strategy:** use these as the primary wiring mechanism. All major browsers now support the element reference properties (Baseline 2025). Keep graceful fallbacks in place for users on older browser versions: same-root `aria-labelledby` attribute (for slotted content) or `aria-label` text mirroring (for light DOM siblings).

### `ariaControlsElements`

[Can I use — ariaControlsElements](https://caniuse.com/?search=ariaControlsElements)

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ 135+ |
| Safari | ✅ 16.4+ |
| Firefox | ✅ 136+ |

**Note:** The combobox uses the `aria-controls="listbox"` *attribute* (not the element ref property) because the listbox is in the same shadow root. The property is only needed when the target is in a different root.

### `ariaActiveDescendantElement`

[Can I use — ariaActiveDescendantElement](https://caniuse.com/?search=ariaActiveDescendantElement)

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ 135+ |
| Safari | ✅ 16.4+ |
| Firefox | ✅ 136+ |

**Current strategy:** detect support with `'ariaActiveDescendantElement' in Element.prototype`; fall back to assigning a stable `id` and using `aria-activedescendant` attribute.

### `referenceTarget`

[Can I use — referenceTarget](https://caniuse.com/?search=referenceTarget)

| Browser | Support |
|---------|---------|
| Chrome / Edge | 🚩 133+ (enable `#enable-experimental-web-platform-features` in `chrome://flags`) |
| Firefox | 🚩 144+ (enable `dom.shadowdom.referenceTarget.enabled` in `about:config`) |
| Safari | 🚩 26+ (enable "referenceTarget" in Develop → Feature Flags) |

`referenceTarget` (exposed as `ShadowRoot.referenceTarget` and `<template shadowrootreferencetarget>`) lets a custom element host declare which inner shadow element is the *canonical target* for IDREF resolution — so that `aria-labelledby="my-textfield"` on an external element correctly labels the inner `<input>` without any JS wiring. All three major browsers have implemented it behind a flag; none have enabled it by default yet. This would eliminate the entire cross-root problem for consumers who label by external element ID.

### `referenceTargetMap`

No Can I use page yet — this is a proposal / explainer stage.

| Browser | Support |
|---------|---------|
| All | ❌ No support |

`referenceTargetMap` extends `referenceTarget` to a map of attribute → inner element pairs, enabling per-attribute targeting (`aria-labelledby` → one inner element, `aria-describedby` → another).

**`referenceTarget` is implemented in all major browsers but is flag-gated everywhere — it is not yet on by default in any stable release.** Once browsers enable it by default and it reaches your supported browser range, it should become the primary cross-root labelling mechanism: consumers would be able to use a plain `aria-labelledby` attribute pointing at the custom element host, and the browser would resolve it to the inner role element automatically. At that point the `labelledby`/`describedby` properties, element ref wiring, and many of the fallback paths described in this document become unnecessary. Track the flags above and revisit this approach as browsers ship it unflagged.

### Platform-Provided Behaviors (`HTMLSubmitButtonBehavior`)

[WHATWG html#12150](https://github.com/whatwg/html/issues/12150) · [MSEdge explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ElementInternalsType/explainer.md)

| Browser | Support |
|---------|---------|
| Chrome / Edge | 🚧 Implementing — no stable release yet |
| Safari | ❌ Standards position filed; pending |
| Firefox | ❌ Standards position filed; pending |

`HTMLSubmitButtonBehavior` is passed via `attachInternals({ behaviors: [...] })` and provides the two capabilities that `ElementInternals` alone cannot: **implicit form submission** (Enter in a text field claims the default submit button at the platform level) and the **`:default` CSS pseudo-class**. Until all target browsers ship it, use `ButtonAssociationController` as a shim — see [Platform-Provided Behaviors](#platform-provided-behaviors) for the full API surface and [Migrating from `ButtonAssociationController`](#migrating-from-buttonassociationcontroller) for the feature-detection branch pattern.


---

## Component authoring

### 1. Shadow DOM structure

The controller finds elements by the IDs `#role`, `#label`, and `#description`. Use exactly these IDs in the shadow template:

```html
<span id="label" class="field-label" hidden>
    <slot name="label"></slot>
</span>

<!-- role element — native input or div with explicit role -->
<input id="role" type="text" class="textfield-input" />

<span id="description" class="field-help" hidden>
    <slot name="description"></slot>
</span>
```

> For combobox, also add the listbox in the shadow DOM and give the options their own slot:
> ```html
> <ul id="listbox" role="listbox" hidden>
>     <slot name="options"></slot>
> </ul>
> ```

### 2. Component class

```js
import {
    LabellingController,
    LABELLING_DEBUG_HTML,
    applyLabellingDebug,
} from './labelling-controller.js';

class MyTextfield extends HTMLElement {
    #labelling = new LabellingController({ onUpdate: () => this.#updateDebug() });

    constructor() {
        super();
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    static get observedAttributes() { return ['labelledby', 'describedby']; }
    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
    }

    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="./styles.css" />
            <div class="field-host">
                <span id="label" class="field-label" hidden>
                    <slot name="label"></slot>
                </span>
                <input id="role" type="text" class="textfield-input" part="input" />
                <span id="description" class="field-help" hidden>
                    <slot name="description"></slot>
                </span>
                <div class="debug">
                    <p class="debug-heading">Debug</p>
                    <dl class="debug-list">${LABELLING_DEBUG_HTML}</dl>
                </div>
            </div>
        `;
        this.#labelling.connect(this.shadowRoot);
    }

    #updateDebug() {
        applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo);
    }
}

customElements.define('my-textfield', MyTextfield);
```

### 3. Adding form association

```js
import { FieldAssociationController } from './field-association-controller.js';

class MyTextfield extends HTMLElement {
    static formAssociated = true;            // must stay on the element class
    #internals  = this.attachInternals();    // must stay on the element class
    #fieldAssoc = new FieldAssociationController(this.#internals);

    // ... existing labelling setup ...

    get form()              { return this.#fieldAssoc.form; }
    get validity()          { return this.#fieldAssoc.validity; }
    get validationMessage() { return this.#fieldAssoc.validationMessage; }
    get willValidate()      { return this.#fieldAssoc.willValidate; }
    checkValidity()         { return this.#fieldAssoc.checkValidity(); }
    reportValidity()        { return this.#fieldAssoc.reportValidity(); }

    formResetCallback() { this.value = this.#fieldAssoc.defaultValue; }

    connectedCallback() {
        // ... shadow template setup ...
        this.#inputEl.addEventListener('input', () => {
            this.#fieldAssoc.setValue(this.#inputEl.value);
        });
    }
}
```

### 4. Combobox extras

For a combobox, the listbox lives in the shadow DOM alongside the trigger, so `aria-controls` can reference it by same-root ID. The active option is a slotted light DOM element, so use `ariaActiveDescendantElement` (cross-root element ref):

```js
const SUPPORTS_ACTIVE_DESCENDANT = 'ariaActiveDescendantElement' in Element.prototype;

#activateOption(optionEl) {
    if (SUPPORTS_ACTIVE_DESCENDANT) {
        this.#triggerEl.ariaActiveDescendantElement = optionEl;
    } else {
        if (!optionEl.id) optionEl.id = `option-${crypto.randomUUID()}`;
        this.#triggerEl.setAttribute('aria-activedescendant', optionEl.id);
    }
}
```

### Rules for component authors

1. **Role on the inner shadow element, never the host.** Use a native `<input>` for textfield and checkbox; use `<div role="...">` for progressbar, combobox, etc.

2. **Attach shadow with `delegatesFocus: true`.** This makes the custom element a single tab stop that delegates focus to the first focusable shadow element.

3. **Use the required IDs.** The controller expects `id="role"`, `id="label"`, and `id="description"` in the shadow DOM. Do not rename them.

4. **Start label and description spans `hidden`.** The controller reveals them only when their slot has content. Never show them unconditionally.

5. **Name slots exactly `"label"` and `"description"`.** The controller watches those exact slot names via `slotchange`.

6. **Instantiate `LabellingController` in the class body**, not in `connectedCallback`. Call `controller.connect(this.shadowRoot)` from `connectedCallback` after `innerHTML` is set.

7. **Delegate `labelledby` and `describedby` to the controller.** Getters and setters should proxy to `this.#labelling.labelledby` / `this.#labelling.describedby`. Reflect them as observed attributes so the properties work declaratively in HTML.

8. **Do not use `aria-labelledby` / `aria-describedby` ID attributes to reference light DOM elements from a shadow element.** ID references do not cross shadow root boundaries. Use `ariaLabelledByElements` / `ariaDescribedByElements` instead — the `LabellingController` does this for you.

9. **Do not wire labelling through `ElementInternals`.** Same-root ID attributes and `ariaLabelledByElements` on the inner role element are sufficient. `ElementInternals` is only needed for form participation (`setFormValue`, `setValidity`).

10. **For form-associated fields, keep `static formAssociated = true` and `attachInternals()` on the element class.** Pass the resulting `ElementInternals` to `FieldAssociationController`. Call `fieldAssoc.setValue(null)` for disabled fields and unchecked checkboxes so they are excluded from `FormData`.

11. **For form-associated buttons, use `ButtonAssociationController`.** It wires keyboard activation, ARIA role, focusability, and `commandfor`/`command` dispatch as a shim until `HTMLSubmitButtonBehavior` ships broadly. Keep the form submit/reset logic in a `click` listener on the host (`internals.form?.requestSubmit()` / `internals.form?.reset()`) — the controller does not own that path.

12. **Prefer slotted labels for standalone components; use `labelledby`/`describedby` properties for contextual placement.** If a field will appear inside a data grid, a multi-section form, or anywhere the surrounding structure already provides a label (table headers, section headings, shared footnotes), wire it through the `labelledby`/`describedby` properties rather than requiring consumers to duplicate that text in a slot. Both sources can be active simultaneously — the controller merges them.

13. **For combobox:** put `role="listbox"` in the shadow DOM and reference it with `aria-controls` by same-root ID attribute. For the active option — which lives in the light DOM — use `ariaActiveDescendantElement` (cross-root element ref). Fall back to assigning a stable `id` and using `aria-activedescendant` attribute if the property is unavailable.

14. **Re-check `describedby` + slot interactions.** The controller automatically merges both when both are present. If your component has custom re-wiring logic, ensure it follows the same merge pattern rather than treating the two sources as mutually exclusive.

15. **Exclude known axe-core false positives at the story level** — not globally. Include a `// reason:` comment and upstream issue link. Remove exclusions as Deque ships fixes.

16. **Test with a screen reader.** Verify that the accessible name and description appear in the accessibility tree for every labelling mode the component supports. Axe-core is supplementary for these patterns; screen reader testing is authoritative.

---

## Consumer usage examples

### Slotted label and description

```html
<my-textfield>
    <span slot="label">Email address</span>
    <span slot="description">We'll never share your email.</span>
</my-textfield>

<my-checkbox>
    <span slot="label">Subscribe to newsletter</span>
    <span slot="description">You can unsubscribe at any time.</span>
</my-checkbox>

<my-combobox>
    <span slot="label">Favorite fruit</span>
    <span slot="description">Arrow keys navigate, Enter or Space selects.</span>
    <li slot="options" role="option" aria-selected="false">Apple</li>
    <li slot="options" role="option" aria-selected="false">Banana</li>
    <li slot="options" role="option" aria-selected="false">Cherry</li>
</my-combobox>
```

### Light DOM siblings via `labelledby` / `describedby`

```html
<!-- Standalone form field -->
<label id="email-label">Email address</label>
<my-textfield labelledby="email-label" describedby="email-desc"></my-textfield>
<p id="email-desc">We'll never share your email.</p>

<!-- Data grid: column header labels inline field -->
<th id="name-col">Name</th>
<!-- ... (in a table cell) ... -->
<my-textfield labelledby="name-col"></my-textfield>
```

### Setting properties in JavaScript

```js
const field = document.querySelector('my-textfield');
field.labelledby  = 'email-label';
field.describedby = 'email-desc';
```

### Both sources together

```html
<my-textfield describedby="global-error">
    <span slot="label">Email address</span>
    <span slot="description">We'll never share your email.</span>
</my-textfield>
<p id="global-error" role="alert">This field is required.</p>
```


---

## Demos

| Demo | Description |
|------|-------------|
| [Shadow DOM label and description](./demo-shadow-role.html) | Named slots — same-root `aria-labelledby`/`aria-describedby` |
| [Light DOM siblings](./demo-light-siblings.html) | `labelledby` / `describedby` properties — `ariaLabelledByElements` cross-root element refs |
| [Hybrid with toggle](./demo-hybrid.html) | Both patterns in one component; toggle button switches live between slotted and sibling mode |
| [Form association](./demo-form.html) | `textfield-form`, `checkbox-form`, `combobox-form` — `FieldAssociationController` + `button-form` alongside native equivalents |
| [Platform-Provided Behaviors shim](./demo-form-behaviors.html) | `button-behaviors` using `ButtonAssociationController` — dialog, popover, form commands, and custom `CommandEvent` with cancellation |

---

## Run locally

```bash
npm install
npm start
```

Open [http://localhost:8080/index.html](http://localhost:8080/index.html).

---

## Further reading

### [Inside ElementInternals — an interactive field manual](https://plasticmind.github.io/elementinternals-a11y/) (plasticmind)

An eight-module interactive curriculum that teaches `attachInternals()` from the ground up — form participation, constraint validation, ARIA semantics, and real-world component archetypes.

### [Let Equals Equal Equals](https://bennypowers.dev/posts/let-equals-equal-equals/) (Benny Powers)

An advocacy article on the silent failure mode of `ariaLabelledByElements` and friends: assigning a cross-root element reference succeeds without error but the getter returns `null` and screen readers receive nothing. The article explains why placing the role on an **inner shadow element** and using same-root ID attributes or element refs that flow from shadow → lighter DOM sidesteps the failure mode entirely.

---

## References

- [`Element.ariaLabelledByElements` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements)
- [`Element.ariaDescribedByElements` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaDescribedByElements)
- [`Element.ariaActiveDescendantElement` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaActiveDescendantElement)
- [`ElementInternals` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
- [Can I use — ariaLabelledByElements](https://caniuse.com/?search=ariaLabelledByElements)
- [Can I use — ariaDescribedByElements](https://caniuse.com/?search=ariaDescribedByElements)
- [Can I use — ariaActiveDescendantElement](https://caniuse.com/?search=ariaActiveDescendantElement)
- [Can I use — ariaControlsElements](https://caniuse.com/?search=ariaControlsElements)
- [Can I use — referenceTarget](https://caniuse.com/?search=referenceTarget)
- [Deque axe-core elementInternals issues](https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals)
- [Reflected ARIA attributes guide (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
- [WHATWG html#12150 — Platform-Provided Behaviors (Stage 1)](https://github.com/whatwg/html/issues/12150)
- [WHATWG html#12409 — Platform-Provided Behaviors spec PR](https://github.com/whatwg/html/pull/12409)
- [MSEdge explainer — ElementInternalsType / Platform-Provided Behaviors](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/ElementInternalsType/explainer.md)
- [Blink-dev Intent to Prototype — Platform-Provided Behaviors](http://www.mail-archive.com/blink-dev@chromium.org/msg15958.html)
- [Blink-dev Intent to Ship — Platform-Provided Behaviors](http://www.mail-archive.com/blink-dev@chromium.org/msg16533.html)
- [W3C public-html thread — Platform-Provided Behaviors](https://lists.w3.org/Archives/Public/public-html/2026Jun/0001.html)
