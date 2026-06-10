# Form fields strategy demos

Live examples and a reference implementation for building accessible form field web components where the **ARIA role lives inside the shadow DOM**.

**[Open in StackBlitz](https://stackblitz.com/github/nikkimk/web-component-form-strategy-demos)** · **[All demos](./index.html)**

---

## Recommendation: put the role in the shadow DOM

Place the ARIA role on an **inner shadow DOM element** — not on the custom element host.

- For **textfield** and **checkbox**, use a native `<input>`. The browser supplies the role, focus behavior, and keyboard semantics automatically.
- For **progressbar**, **combobox**, and other non-native roles, use a `<div role="...">` inside the shadow root.

This approach keeps ARIA semantics co-located with the element that actually manages them, avoids the limitations of `ElementInternals` for cross-root labelling, and lets the browser's accessibility tree see a real native element or a correctly-roled shadow element.

```html
<!-- textfield -->
<input id="role" type="text" aria-labelledby="label" aria-describedby="description" />

<!-- combobox -->
<div id="role" role="combobox" aria-labelledby="label" aria-describedby="description"
     aria-controls="listbox" aria-expanded="false" tabindex="0"></div>
```

Use `delegatesFocus: true` when attaching the shadow root so a single tab stop on the host delegates focus to the inner role element automatically:

```js
this.attachShadow({ mode: 'open', delegatesFocus: true });
```

---

## Labelling strategy

Two sources of label and description text are supported and can be combined.

### 1. Shadow DOM slots (optional)

Each component exposes two **named slots** that let consumers project label and description text into the shadow DOM:

| Slot | Purpose |
|------|---------|
| `slot="label"` | Text rendered inside the shadow label span |
| `slot="description"` | Text rendered inside the shadow description span |

The shadow DOM structure wrapping these slots:

```html
<span id="label" class="field-label" hidden>
    <slot name="label"></slot>
</span>

<input id="role" type="text" />

<span id="description" class="field-help" hidden>
    <slot name="description"></slot>
</span>
```

The spans start `hidden`. The `LabellingController` shows them only when slot content is present, and wires the role element to them using `aria-labelledby="label"` / `aria-describedby="description"` — same-root ID references, which work reliably within a single shadow root.

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

These properties use the [element reference API](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements) (`ariaLabelledByElements` / `ariaDescribedByElements`), which works **cross-root** — a shadow element can reference a light DOM element as its label source.

**Consumer usage:**

```html
<label id="email-label">Email address</label>
<my-textfield
    labelledby="email-label"
    describedby="email-desc"
></my-textfield>
<p id="email-desc">We'll never share your email.</p>
```

Or set the properties directly in JavaScript:

```js
const field = document.querySelector('my-textfield');
field.labelledby  = 'email-label';
field.describedby = 'email-desc';
```

### Combining both sources for description

When `describedby` is set **and** slotted description content is present, the controller includes **both** in `ariaDescribedByElements` — the shadow description span comes first, followed by any resolved light DOM elements. This allows a component to provide a built-in contextual description while still accepting supplementary help text from the page.

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
    // Instantiate the controller in the class body
    #labelling = new LabellingController({ onUpdate: () => this.#updateDebug() });

    constructor() {
        super();
        // delegatesFocus forwards tab focus to the first focusable shadow element
        this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    // Reflect labelledby and describedby as attributes so they can be set in HTML
    static get observedAttributes() { return ['labelledby', 'describedby']; }
    attributeChangedCallback(name, _, val) {
        if (name === 'labelledby')  this.labelledby  = val ?? '';
        if (name === 'describedby') this.describedby = val ?? '';
    }

    // Delegate property get/set to the controller
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
        // Connect the controller after innerHTML is set
        this.#labelling.connect(this.shadowRoot);
    }

    #updateDebug() {
        applyLabellingDebug(this.shadowRoot, this.#labelling.debugInfo);
    }
}

customElements.define('my-textfield', MyTextfield);
```

### 3. Combobox extras

For a combobox, the listbox lives in the shadow DOM alongside the trigger, so `aria-controls` can reference it by same-root ID. The active option is a slotted light DOM element, so use `ariaActiveDescendantElement` (cross-root element ref):

```js
// aria-controls works via same-root ID attribute — set it in HTML
// <div id="role" role="combobox" aria-controls="listbox" ...>
// <ul  id="listbox" role="listbox" ...>

// Active descendant — cross-root, requires element ref API
const SUPPORTS_ACTIVE_DESCENDANT = 'ariaActiveDescendantElement' in Element.prototype;

#activateOption(optionEl) {
    if (SUPPORTS_ACTIVE_DESCENDANT) {
        this.#triggerEl.ariaActiveDescendantElement = optionEl;
    } else {
        // Fallback: give the option a stable ID, use the attribute
        if (!optionEl.id) optionEl.id = `option-${crypto.randomUUID()}`;
        this.#triggerEl.setAttribute('aria-activedescendant', optionEl.id);
    }
}
```

---

## Consumer usage examples

### Slotted label and description

Slot `name="label"` and `name="description"` project text into the component's shadow label/description spans:

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

Place the label and description as siblings and point the component to them by ID:

```html
<label id="email-label">Email address</label>
<my-textfield labelledby="email-label" describedby="email-desc"></my-textfield>
<p id="email-desc">We'll never share your email.</p>

<span id="fruit-label">Favorite fruit</span>
<my-combobox labelledby="fruit-label" describedby="fruit-desc">
    <li role="option" aria-selected="false">Apple</li>
    <li role="option" aria-selected="false">Banana</li>
</my-combobox>
<p id="fruit-desc">Arrow keys navigate, Enter or Space selects.</p>
```

### Setting properties in JavaScript

```js
const field = document.querySelector('my-textfield');
field.labelledby  = 'email-label';
field.describedby = 'email-desc';
```

### Both sources together

When both are provided, the slotted description and the light DOM description are **both** included in `ariaDescribedByElements`:

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

8. **Do not use `aria-labelledby` / `aria-describedby` ID attributes to reference light DOM elements from a shadow element.** ID references do not cross shadow root boundaries. Use the element reference API (`ariaLabelledByElements`) instead — the controller does this for you.

9. **Do not wire labelling through `ElementInternals`.** Same-root ID attributes and `ariaLabelledByElements` on the inner role element are sufficient. `ElementInternals` is only needed if the host itself must carry the role.

10. **For combobox:** put `role="listbox"` in the shadow DOM and reference it with `aria-controls` by same-root ID (attribute, works). For the active option — which lives in the light DOM — use `ariaActiveDescendantElement` (element ref, works cross-root). Fall back to assigning a stable `id` and using `aria-activedescendant` attribute if the property is unavailable.

11. **Re-check `describedby` + slot interactions.** The controller automatically merges both when both are present. If your component has custom re-wiring logic, ensure it follows the same merge pattern rather than treating the two sources as mutually exclusive.

12. **Test with a screen reader.** Verify that the accessible name and description appear in the accessibility tree for every labelling mode the component is expected to support.

---

## Demos

| Demo | Labelling pattern |
|------|-------------------|
| [Shadow DOM label and description](./demo-shadow-role.html) | Named slots — `ariaLabelledByElements` → shadow span (same-root element ref) |
| [Light DOM siblings](./demo-light-siblings.html) | `labelledby` / `describedby` properties — `ariaLabelledByElements` → light DOM element (cross-root element ref) |
| [Hybrid with toggle](./demo-hybrid.html) | Both patterns in one component; toggle button switches live between slotted and sibling mode |

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

An eight-module interactive curriculum that teaches `attachInternals()` from the ground up — form participation, constraint validation, ARIA semantics, and real-world component archetypes. Useful context for understanding when `ElementInternals` is and is not the right tool.

### [Let Equals Equal Equals](https://bennypowers.dev/posts/let-equals-equal-equals/) (Benny Powers)

An advocacy article on the silent failure mode of `ariaLabelledByElements` and friends: assigning a cross-root element reference succeeds without error but the getter returns `null` and screen readers receive nothing. The article explains why this pattern — placing the role on an **inner shadow element** and using same-root ID attributes or element refs that flow from shadow → lighter DOM — sidesteps the failure mode entirely.

---

## References

- [`Element.ariaLabelledByElements` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements)
- [`Element.ariaDescribedByElements` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaDescribedByElements)
- [`Element.ariaActiveDescendantElement` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaActiveDescendantElement)
- [Cross-root labelling CodePen (Spectrum CSS)](https://codepen.io/spectrum-css/pen/pvNEVda)
- [Reflected ARIA attributes guide (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Reflected_attributes)
