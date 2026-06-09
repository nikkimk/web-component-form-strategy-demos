/**
 * Shared combobox custom element base using reflected ARIA element references.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/ariaControlsElements
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaDescribedByElements
 */

import { createLogRefresher, mirrorShadowAccessibleName, resolveLogElement } from './form-field-base.js';

export { createLogRefresher, resolveLogElement };

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isShadowElement(element) {
    return element.getRootNode() instanceof ShadowRoot;
}

/**
 * @param {HTMLElement} element
 * @param {string} prefix
 */
function ensureFallbackId(element, prefix) {
    if (!element.id) {
        element.id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return element.id;
}

/**
 * @param {HTMLElement[]} elements
 */
function partitionByRoot(elements) {
    const light = [];
    const shadow = [];

    elements.filter(Boolean).forEach((element) => {
        if (isShadowElement(element)) {
            shadow.push(element);
        } else {
            light.push(element);
        }
    });

    return { light, shadow };
}

/**
 * @param {HTMLElement[]} elements
 */
function prepareRefTargets(elements) {
    return elements.filter(Boolean).map((element, index) => {
        ensureFallbackId(element, `ref-${index}`);
        return element;
    });
}

export const SUPPORTS_ELEMENT_REFS = 'ariaControlsElements' in Element.prototype;

/**
 * @param {HTMLElement} host
 * @param {ElementInternals} internals
 * @param {HTMLElement} listbox
 * @param {HTMLElement[]} labelElements
 * @param {HTMLElement[]} descriptionElements
 */
export function syncAriaElementRefs(
    host,
    internals,
    listbox,
    labelElements = [],
    descriptionElements = []
) {
    const resync = () => {
        host.setAttribute('tabindex', '0');
        host.setAttribute('aria-haspopup', 'listbox');

        const { light: lightLabels, shadow: shadowLabels } = partitionByRoot(labelElements);
        const { light: lightDescriptions, shadow: shadowDescriptions } =
            partitionByRoot(descriptionElements);

        const preparedLightLabels = prepareRefTargets(lightLabels);
        const preparedShadowLabels = prepareRefTargets(shadowLabels);
        const preparedLightDescriptions = prepareRefTargets(lightDescriptions);
        const preparedShadowDescriptions = prepareRefTargets(shadowDescriptions);

        if (!SUPPORTS_ELEMENT_REFS) {
            host.setAttribute('role', 'combobox');
            ensureFallbackId(listbox, 'listbox');
            host.setAttribute('aria-controls', listbox.id);

            if (preparedLightLabels.length) {
                host.setAttribute(
                    'aria-labelledby',
                    preparedLightLabels.map((el) => el.id).join(' ')
                );
            } else {
                host.removeAttribute('aria-labelledby');
            }

            if (preparedLightDescriptions.length) {
                host.setAttribute(
                    'aria-describedby',
                    preparedLightDescriptions.map((el) => el.id).join(' ')
                );
            } else {
                host.removeAttribute('aria-describedby');
            }

            return;
        }

        host.removeAttribute('role');
        host.removeAttribute('aria-controls');
        host.removeAttribute('aria-labelledby');
        host.removeAttribute('aria-describedby');

        internals.role = 'combobox';
        internals.ariaControlsElements = [listbox];
        internals.ariaLabelledByElements = preparedShadowLabels;
        internals.ariaDescribedByElements = preparedShadowDescriptions;
        host.ariaLabelledByElements = preparedLightLabels;
        host.ariaDescribedByElements = preparedLightDescriptions;

        if (preparedShadowLabels.length || preparedShadowDescriptions.length) {
            mirrorShadowAccessibleName(
                internals,
                preparedShadowLabels,
                preparedShadowDescriptions
            );
        } else {
            internals.ariaLabel = null;
            if ('ariaDescription' in internals) {
                internals.ariaDescription = null;
            }
        }
    };

    resync();
    return resync;
}

/**
 * Slotted options remain in Light DOM, so the host uses aria-activedescendant IDs.
 * @param {HTMLElement} combobox
 * @param {HTMLElement | null} option
 */
export function setActiveDescendant(combobox, option) {
    if (!option) {
        combobox.removeAttribute('aria-activedescendant');
        return;
    }

    ensureFallbackId(option, 'option');
    combobox.setAttribute('aria-activedescendant', option.id);
}

/**
 * @param {Element[]} elements
 * @returns {HTMLElement[]}
 */
export function prepareSlottedOptions(elements) {
    return elements
        .filter((element) => element instanceof HTMLElement)
        .map((option, index) => {
            if (!option.hasAttribute('role')) {
                option.setAttribute('role', 'option');
            }
            option.setAttribute('aria-selected', 'false');
            ensureFallbackId(option, `option-${index}`);
            return option;
        });
}

/**
 * @param {HTMLElement} host
 * @param {(options: HTMLElement[]) => void} callback
 */
export function watchSlottedOptions(host, callback) {
    const slot = host.shadowRoot?.querySelector('slot[name="option"]');
    if (!slot) {
        return () => {};
    }

    const refresh = () => {
        callback(prepareSlottedOptions(slot.assignedElements({ flatten: true })));
    };

    slot.addEventListener('slotchange', refresh);
    refresh();

    return () => slot.removeEventListener('slotchange', refresh);
}

export class ComboboxController {
    /**
     * @param {object} config
     * @param {HTMLElement} config.host
     * @param {HTMLElement} config.trigger
     * @param {HTMLElement} config.valueEl
     * @param {HTMLElement} config.listbox
     * @param {HTMLElement[]} config.options
     * @param {(value: string) => void} [config.onSelect]
     * @param {() => void} [config.onActiveDescendantChange]
     */
    constructor({ host, trigger, valueEl, listbox, options, onSelect, onActiveDescendantChange }) {
        this.host = host;
        this.trigger = trigger;
        this.valueEl = valueEl;
        this.listbox = listbox;
        this.options = options;
        this.onSelect = onSelect ?? (() => {});
        this.onActiveDescendantChange = onActiveDescendantChange ?? (() => {});
        this.open = false;
        this.activeIndex = -1;

        this._onHostKeyDown = this._onHostKeyDown.bind(this);
        this._onHostClick = this._onHostClick.bind(this);
        this._onOptionClick = this._onOptionClick.bind(this);
        this._onDocumentClick = this._onDocumentClick.bind(this);
    }

    connect() {
        this.host.addEventListener('keydown', this._onHostKeyDown);
        this.host.addEventListener('click', this._onHostClick);
        this.options.forEach((option) => {
            option.addEventListener('click', this._onOptionClick);
        });
        document.addEventListener('click', this._onDocumentClick);
        this._setExpanded(false);
    }

    disconnect() {
        this.host.removeEventListener('keydown', this._onHostKeyDown);
        this.host.removeEventListener('click', this._onHostClick);
        this.options.forEach((option) => {
            option.removeEventListener('click', this._onOptionClick);
        });
        document.removeEventListener('click', this._onDocumentClick);
    }

    /**
     * @param {boolean} nextOpen
     */
    _setExpanded(nextOpen) {
        this.open = nextOpen;
        this.host.setAttribute('aria-expanded', String(nextOpen));
        this.listbox.hidden = !nextOpen;

        if (!nextOpen) {
            this.activeIndex = -1;
            this.options.forEach((option) => {
                option.setAttribute('aria-selected', 'false');
            });
            setActiveDescendant(this.host, null);
            this.onActiveDescendantChange();
            return;
        }

        const selectedIndex = this.options.findIndex(
            (option) => option.getAttribute('aria-selected') === 'true'
        );
        const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
        this._activateOption(startIndex);
    }

    /**
     * @param {number} index
     */
    _activateOption(index) {
        if (index < 0 || index >= this.options.length) {
            return;
        }

        this.activeIndex = index;
        this.options.forEach((option, i) => {
            const isActive = i === index;
            option.setAttribute('aria-selected', String(isActive));
        });
        setActiveDescendant(this.host, this.options[index]);
        this.options[index].scrollIntoView({ block: 'nearest' });
        this.onActiveDescendantChange();
    }

    /**
     * @param {number} index
     */
    _selectOption(index) {
        const option = this.options[index];
        if (!option) {
            return;
        }

        const value = option.textContent?.trim() ?? '';
        this.valueEl.textContent = value;
        this.onSelect(value);
        this._setExpanded(false);
        this.host.focus();
    }

    /**
     * @param {KeyboardEvent} event
     */
    _onHostKeyDown(event) {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (!this.open) {
                    this._setExpanded(true);
                } else {
                    this._activateOption(
                        Math.min(this.activeIndex + 1, this.options.length - 1)
                    );
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (!this.open) {
                    this._setExpanded(true);
                } else {
                    this._activateOption(Math.max(this.activeIndex - 1, 0));
                }
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (!this.open) {
                    this._setExpanded(true);
                } else if (this.activeIndex >= 0) {
                    this._selectOption(this.activeIndex);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this._setExpanded(false);
                break;
            case 'Home':
                if (this.open) {
                    event.preventDefault();
                    this._activateOption(0);
                }
                break;
            case 'End':
                if (this.open) {
                    event.preventDefault();
                    this._activateOption(this.options.length - 1);
                }
                break;
            default:
                break;
        }
    }

    _onHostClick(event) {
        event.stopPropagation();
        if (document.activeElement !== this.host) {
            this.host.focus();
        }
        this._setExpanded(!this.open);
    }

    /**
     * @param {MouseEvent} event
     */
    _onOptionClick(event) {
        event.stopPropagation();
        const option = /** @type {HTMLElement} */ (event.currentTarget);
        const index = this.options.indexOf(option);
        if (index >= 0) {
            this._selectOption(index);
        }
    }

    /**
     * @param {MouseEvent} event
     */
    _onDocumentClick(event) {
        if (!this.open) {
            return;
        }

        const path = event.composedPath();
        if (!path.includes(this.host)) {
            this._setExpanded(false);
        }
    }
}

/**
 * @param {HTMLElement} statusEl
 */
export function renderSupportStatus(statusEl) {
    statusEl.innerHTML = SUPPORTS_ELEMENT_REFS
        ? '<strong>Supported:</strong> Widget <code>role</code> and shadow listbox use <code>ElementInternals</code>. Shadow label/help use element refs plus mirrored <code>ariaLabel</code> / <code>ariaDescription</code>. Light or slotted label/help use the host. Slotted options use <code>aria-activedescendant</code> on the host.'
        : '<strong>Fallback:</strong> Element reference properties are unavailable. Light DOM label/help fall back to ID attributes on the host. Shadow listbox controls cannot be linked without element refs. Options use <code>aria-activedescendant</code>.';
}

/**
 * @param {HTMLElement} logEl
 * @param {HTMLElement} host
 * @param {ElementInternals} internals
 * @param {HTMLElement} listbox
 * @param {HTMLElement[]} labels
 * @param {HTMLElement[]} descriptions
 * @param {HTMLElement[]} [options]
 */
export function logAriaRefs(
    logEl,
    host,
    internals,
    listbox,
    labels,
    descriptions,
    options = []
) {
    const lines = [];
    const role = SUPPORTS_ELEMENT_REFS ? internals.role : host.getAttribute('role');

    lines.push(`role="${role ?? ''}" (via ${SUPPORTS_ELEMENT_REFS ? 'internals' : 'host'})`);

    if (SUPPORTS_ELEMENT_REFS) {
        lines.push(
            `internals.ariaControlsElements → ${formatElements(internals.ariaControlsElements)}`
        );
        lines.push(
            `internals.ariaLabelledByElements → ${formatElements(internals.ariaLabelledByElements)}`
        );
        lines.push(
            `internals.ariaDescribedByElements → ${formatElements(internals.ariaDescribedByElements)}`
        );
        lines.push(
            `host.ariaLabelledByElements → ${formatElements(host.ariaLabelledByElements)}`
        );
        lines.push(
            `host.ariaDescribedByElements → ${formatElements(host.ariaDescribedByElements)}`
        );

        if (internals.ariaLabel) {
            lines.push(`internals.ariaLabel="${internals.ariaLabel}"`);
        }

        if ('ariaDescription' in internals && internals.ariaDescription) {
            lines.push(`internals.ariaDescription="${internals.ariaDescription}"`);
        }

        lines.push(`listbox element: ${describeElement(listbox)}`);
        labels.forEach((label, i) => {
            lines.push(`label[${i}]: ${describeElement(label)} (${label.textContent?.trim()})`);
        });
        descriptions.forEach((desc, i) => {
            lines.push(
                `description[${i}]: ${describeElement(desc)} (${desc.textContent?.trim()})`
            );
        });
    } else {
        lines.push(`aria-controls="${host.getAttribute('aria-controls') ?? ''}"`);
        lines.push(`aria-labelledby="${host.getAttribute('aria-labelledby') ?? ''}"`);
        lines.push(`aria-describedby="${host.getAttribute('aria-describedby') ?? ''}"`);
    }

    options.forEach((option, i) => {
        lines.push(`option[${i}]: ${describeElement(option)} (${option.textContent?.trim()})`);
    });

    const activeId = host.getAttribute('aria-activedescendant');
    lines.push(
        activeId
            ? `aria-activedescendant="${activeId}"`
            : 'aria-activedescendant=""'
    );

    logEl.textContent = lines.join('\n');
}

/**
 * @param {HTMLElement[] | undefined} elements
 */
function formatElements(elements) {
    if (!elements?.length) {
        return '[]';
    }
    return `[${elements.map((el) => describeElement(el)).join(', ')}]`;
}

/**
 * @param {HTMLElement} element
 */
function describeElement(element) {
    const parts = [element.tagName.toLowerCase()];
    if (element.id) {
        parts.push(`#${element.id}`);
    }
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
        parts.push('(shadow)');
    } else {
        parts.push('(light)');
    }
    return parts.join('');
}
