# Form fields strategy demos

Live examples and a reference implementation for building accessible, form-associated web components where the **ARIA role lives inside the shadow DOM**.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

---

## TL;DR — quick reference for component authors

### ElementInternals / form-associated custom elements (FACE)

**Recommendation: yes, with care.**

Use `static formAssociated = true` and `attachInternals()` for any field component that needs to participate in a `<form>` (text inputs, checkboxes, comboboxes, etc.). This is the only standards-based way to achieve native form participation without wrapping a hidden `<input>`.

| Topic | Guidance |
|-------|----------|
| Browser support | Chromium 77+, Safari 16.4+, Firefox 93+. Well-supported in modern targets. |
| AT exposure | Most screen readers read ARIA set via `ElementInternals` in Chromium and Safari. Firefox AT exposure is less consistent; verify with real devices. |
| axe-core | Axe-core has gaps — see [axe-core policy](#axe-core-policy-and-elementinternals) below. Several rules produce false positives or blind spots today. |
| Buttons | Do **not** use FACE for buttons. Use it only for field-like controls that submit values. See [form-associated buttons](#form-associated-buttons) for the correct pattern. |

### Where ARIA roles live

**Recommendation: inner shadow DOM element, never the host.**

| Control class | Role placement |
|---------------|---------------|
| Text input, search, email, etc. | Shadow `<input type="text">` — role is native |
| Checkbox, radio | Shadow `<input type="checkbox">` — role is native |
| Progressbar, meter | Shadow `<div role="progressbar">` |
| Combobox / listbox | Shadow `<div role="combobox">` + shadow `<ul role="listbox">` |

The host element carries no role. This is intentional — it lets the shadow DOM own the element's semantics, its label/help text, and all associated CSS as a single encapsulated unit.

### IDREF strategy

**Recommendation: hybrid — shadow DOM slots for default label/help, element ref properties for cross-root wiring.**

| Scenario | Mechanism |
|----------|-----------|
| Label/help text supplied by the consumer as slotted children | `<slot name="label">` / `<slot name="description">` → same-root `aria-labelledby`/`aria-describedby` attribute on the inner role element |
| Label/help text lives in the light DOM as siblings (e.g. data grid column header labels a cell's inline field) | `labelledby` / `describedby` properties → `ariaLabelledByElements` / `ariaDescribedByElements` cross-root element refs on the inner role element |
| Both present simultaneously | Both sources are merged; shadow description span comes first |

Never use `aria-labelledby` attribute to point at a light DOM ID from inside a shadow root — ID references do not cross shadow root boundaries.

### axe-core policy

**Recommendation: document exclusions at the story level with rationale; track upstream.**

Deque has been shipping ElementInternals support in tranches (ARIA from internals, cross-root element refs, extension-related behavior — targeted through 2025). axe-core still produces false positives and blind spots for FACE components in many versions. Check the [elementInternals label](https://github.com/dequelabs/axe-core/issues?q=label%3AelementInternals) for current status and remove exclusions as fixes land. The correct response is:

1. Exclude affected rules per component story with a `// reason:` comment.
2. Log an upstream issue link alongside each exclusion.
3. Treat screen reader spot-checks as authoritative for these patterns; axe-core is supplementary only.
4. Revisit exclusions each quarter as Deque ships fixes.

See [axe-core policy and ElementInternals](#axe-core-policy-and-elementinternals) for the full list of rules and rationale.

---

## Recommendation: put the role in the shadow DOM

Place the ARIA role on an **inner shadow DOM element** — not on the custom element host.

- For **textfield** and **checkbox**, use a native `<input>`. The browser supplies the role, focus behavior, and keyboard semantics automatically.
- For **progressbar**, **combobox**, and other non-native roles, use a `<div role="...">` inside the shadow root.

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

## Labelling strategy

Two sources of label and description text are supported and can be combined. **We recommend the hybrid approach** — shadow DOM slots for the common case, light DOM element refs for contextual overrides — so that consumers can always use whichever fits their page structure.

A concrete example of why both are needed: a text field used standalone in a form can be labeled with a slotted `<span slot="label">`. The same field component dropped into a data grid cell should be labeled by the column header — an element elsewhere in the light DOM. Both cases must work without the consumer rewriting the component.

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

**Consumer usage:**

```html
<!-- Data grid: field labeled by column header and row header -->
<label id="col-header">Email address</label>
<my-textfield
    labelledby="col-header"
    describedby="col-help"
></my-textfield>
<p id="col-help">We'll never share your email.</p>
```

Or set the properties directly in JavaScript:

```js
const field = document.querySelector('my-textfield');
field.labelledby  = 'col-header';
field.describedby = 'col-help';
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

---

## The `LabellingController`

[`labelling-controller.js`](./labelling-controller.js) is a plain JavaScript controller (no framework required) that encapsulates all labelling logic so it does not have to be duplicated across components.

### What it does

- **Watches `slot[name="label"]` and `slot[name="description"]`** via `slotchange` and re-wires ARIA whenever content is added or removed.
- **Shows or hides the shadow label/description spans** depending on whether their slot has content.
- **Sets `ariaLabelledByElements`** on the inner role element, pointing at the shadow label span when slotted, or at resolved light DOM elements when not.
- **Sets `ariaDescribedByElements`** combining both shadow and light DOM sources when both are present.
- **Falls back gracefully** when `ariaLabelledByElements` is not supported: same-root `aria-labelledby` attribute is used for slotted content; `aria-label` / `aria-description` text-mirroring is used for light DOM siblings.
- **Calls `onUpdate()`** after every re-wire so the host component can refresh its debug panel or any other derived state.

### Exports

| Export | Purpose |
|--------|---------|
| `LabellingController` | The controller class |
| `LABELLING_DEBUG_HTML` | A `<dt>`/`<dd>` HTML snippet to paste into a shadow debug panel |
| `applyLabellingDebug(shadowRoot, info)` | Writes `controller.debugInfo` into those debug rows |

---

## Form association

Custom elements can participate in `<form>` submission and reset using the [ElementInternals API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals). The key requirements are:

1. Declare `static formAssociated = true` on the class.
2. Call `attachInternals()` to get an `ElementInternals` instance.
3. Call `internals.setFormValue(val)` whenever the field's value changes.
4. Implement `formResetCallback()` to restore the field to its default state.

### The `FieldAssociationController`

[`field-association-controller.js`](./field-association-controller.js) encapsulates the `ElementInternals` API surface shared by all form-associated **field** components (textfield, checkbox, combobox, etc.) so this logic is not duplicated.

The host element must still declare `static formAssociated = true` and call `attachInternals()` itself — these cannot be delegated. The controller receives the resulting `ElementInternals` object and wraps it.

#### What it does

- **`setValue(val)`** — Calls `internals.setFormValue(val)`. Pass `null` to exclude the field from `FormData` (unchecked checkbox, disabled field, unselected combobox).
- **`defaultValue`** — Get/set the value the field restores to on `formResetCallback`. Populated from the `value` attribute.
- **`form`, `validity`, `validationMessage`, `willValidate`** — Pass-through getters.
- **`checkValidity()` / `reportValidity()`** — Pass-through methods.

#### Usage example

```js
import { LabellingController } from './labelling-controller.js';
import { FieldAssociationController } from './field-association-controller.js';

class MyTextfield extends HTMLElement {
    // Both declarations stay on the element — they cannot be delegated
    static formAssociated = true;
    #internals  = this.attachInternals();

    // Controllers receive the already-created internals
    #labelling  = new LabellingController({ onUpdate: () => this.#updateDebug() });
    #fieldAssoc = new FieldAssociationController(this.#internals);

    #inputEl = null;

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

    // Labelling — delegate to LabellingController
    get labelledby()  { return this.#labelling.labelledby; }
    get describedby() { return this.#labelling.describedby; }
    set labelledby(val)  { this.#labelling.labelledby  = val; }
    set describedby(val) { this.#labelling.describedby = val; }

    // Form value
    get value() { return this.#inputEl?.value ?? ''; }
    set value(val) {
        if (this.#inputEl) this.#inputEl.value = val ?? '';
        this.#fieldAssoc.setValue(val ?? '');
    }

    // Form introspection — delegate to FieldAssociationController
    get form()              { return this.#fieldAssoc.form; }
    get validity()          { return this.#fieldAssoc.validity; }
    get validationMessage() { return this.#fieldAssoc.validationMessage; }
    get willValidate()      { return this.#fieldAssoc.willValidate; }
    checkValidity()         { return this.#fieldAssoc.checkValidity(); }
    reportValidity()        { return this.#fieldAssoc.reportValidity(); }

    // Reset to default
    formResetCallback() { this.value = this.#fieldAssoc.defaultValue; }

    connectedCallback() {
        this.shadowRoot.innerHTML = `/* shadow template */`;
        this.#inputEl = this.shadowRoot.querySelector('#role');

        // Report initial value to the form
        this.#fieldAssoc.setValue(this.#fieldAssoc.defaultValue);

        this.#inputEl.addEventListener('input', () => {
            this.#fieldAssoc.setValue(this.#inputEl.value);
        });

        this.#labelling.connect(this.shadowRoot);
    }

    #syncDisabled() {
        if (this.#inputEl) this.#inputEl.disabled = this.hasAttribute('disabled');
        // Disabled fields are excluded from FormData — pass null
        this.#fieldAssoc.setValue(
            this.hasAttribute('disabled') ? null : (this.#inputEl?.value ?? '')
        );
    }
}
```

#### Checkbox pattern

Native checkboxes exclude themselves from `FormData` when unchecked. Mirror this:

```js
#updateFormValue() {
    this.#fieldAssoc.setValue(
        (this.#inputEl?.checked && !this.hasAttribute('disabled'))
            ? (this.getAttribute('value') ?? 'on')
            : null   // unchecked or disabled → not included in FormData
    );
}
```

#### Combobox pattern

Submit the selected option's `value` attribute, falling back to its text content:

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
    this.#fieldAssoc.setValue(null); // nothing selected → not in FormData
}
```

---

### Form-associated buttons

A shadow DOM `<button type="submit">` does **not** auto-submit the form that contains the custom element host — the browser's default submit behavior is scoped to the shadow root, not the host's owning form.

The correct pattern for a form-associated button:

```js
class MyButton extends HTMLElement {
    static formAssociated = true;
    #internals = this.attachInternals();

    get type() { return this.getAttribute('type') ?? 'submit'; }
    get form()  { return this.#internals.form; }

    connectedCallback() {
        this.attachShadow({ mode: 'open', delegatesFocus: true });
        this.shadowRoot.innerHTML = `<button id="role"><slot>Button</slot></button>`;

        this.shadowRoot.querySelector('#role').addEventListener('click', () => {
            if (this.hasAttribute('disabled')) return;
            if (this.type === 'submit') this.#internals.form?.requestSubmit();
            if (this.type === 'reset')  this.#internals.form?.reset();
        });
    }
}
customElements.define('my-button', MyButton);
```

**Why there is no `ButtonAssociationController`:** The button's only job is to call `internals.form?.requestSubmit()` or `internals.form?.reset()` on click. There is no shared state (no `defaultValue`, no `setValue` lifecycle), no `formResetCallback` to wire up, and no validity to expose. A controller would be two lines of code for the sake of two lines of code. Put the click handler directly on the element class.

---

## axe-core policy and ElementInternals

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
| Chrome / Edge | ✅ 133+ |
| Firefox | ✅ 144+ |
| Safari | 🧪 Safari 26 (preview) |

`referenceTarget` (exposed as `ShadowRoot.referenceTarget` and `<template shadowrootreferencetarget>`) lets a custom element host declare which inner shadow element is the *canonical target* for IDREF resolution — so that `aria-labelledby="my-textfield"` on an external element correctly labels the inner `<input>` without any JS wiring. Chrome, Edge, and Firefox have shipped support; Safari 26 support is in preview and expected to ship with the macOS 26 release cycle. This would eliminate the entire cross-root problem for consumers who label by external element ID.

### `referenceTargetMap`

No Can I use page yet — this is a proposal / explainer stage.

| Browser | Support |
|---------|---------|
| All | ❌ No support |

`referenceTargetMap` extends `referenceTarget` to a map of attribute → inner element pairs, enabling per-attribute targeting (`aria-labelledby` → one inner element, `aria-describedby` → another).

**`referenceTarget` is now broadly available (Chrome/Edge 133+, Firefox 144+, Safari 26 preview).** Once Safari 26 reaches stable and your browser targets are updated, you should strongly consider adopting `referenceTarget` as the primary cross-root labelling mechanism. If consumers can label a custom element host with a plain `aria-labelledby` attribute and have it resolve correctly to the inner role element, the `labelledby`/`describedby` properties, element ref wiring, and many of the fallback paths described in this document become unnecessary. Revisit this approach when Safari 26 is in your supported browser range.

---

## Implementing a new component

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

## Rules for component authors

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

11. **For form-associated buttons, skip the controller.** Call `internals.form?.requestSubmit()` / `internals.form?.reset()` directly in the click handler.

12. **For combobox:** put `role="listbox"` in the shadow DOM and reference it with `aria-controls` by same-root ID attribute. For the active option — which lives in the light DOM — use `ariaActiveDescendantElement` (cross-root element ref). Fall back to assigning a stable `id` and using `aria-activedescendant` attribute if the property is unavailable.

13. **Re-check `describedby` + slot interactions.** The controller automatically merges both when both are present. If your component has custom re-wiring logic, ensure it follows the same merge pattern rather than treating the two sources as mutually exclusive.

14. **Exclude known axe-core false positives at the story level** — not globally. Include a `// reason:` comment and upstream issue link. Remove exclusions as Deque ships fixes.

15. **Test with a screen reader.** Verify that the accessible name and description appear in the accessibility tree for every labelling mode the component supports. Axe-core is supplementary for these patterns; screen reader testing is authoritative.

---

## Demos

| Demo | Labelling pattern |
|------|-------------------|
| [Shadow DOM label and description](./demo-shadow-role.html) | Named slots — same-root `aria-labelledby`/`aria-describedby` |
| [Light DOM siblings](./demo-light-siblings.html) | `labelledby` / `describedby` properties — `ariaLabelledByElements` cross-root element refs |
| [Hybrid with toggle](./demo-hybrid.html) | Both patterns in one component; toggle button switches live between slotted and sibling mode |
| [Form association](./demo-form.html) | `textfield-form`, `checkbox-form`, `combobox-form` — `FieldAssociationController` + `button-form` alongside native equivalents |

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
