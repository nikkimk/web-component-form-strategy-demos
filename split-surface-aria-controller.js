import {
    SUPPORTS_ELEMENT_REFS,
    mirrorShadowAccessibleName,
    partitionByRoot,
    prepareRefTargets,
    ensureFallbackId,
} from './aria-ref-utils.js';
import { watchRefTargets } from './field-ref-watchers.js';

/**
 * Wires label/help across host (light targets) and ElementInternals (shadow targets).
 * Optionally links a shadow popup shell via internals.ariaControlsElements (combobox).
 */
export class SplitSurfaceAriaController {
    /** @type {ReturnType<typeof watchRefTargets>} */
    #unwatchTargets = () => {};

    #connected = false;

    #labelElements = [];

    #descriptionElements = [];

    /**
     * @param {object} config
     * @param {HTMLElement} config.host
     * @param {ElementInternals} config.internals
     * @param {string} config.role
     * @param {HTMLElement[]} [config.labelElements]
     * @param {HTMLElement[]} [config.descriptionElements]
     * @param {() => { labelElements: HTMLElement[], descriptionElements: HTMLElement[] }} [config.resolveRefs]
     * @param {HTMLElement[]} [config.controls] shadow popup/listbox nodes for combobox
     * @param {boolean} [config.focusable]
     * @param {(refs: { labelElements: HTMLElement[], descriptionElements: HTMLElement[] }) => void} [config.onRefsChange]
     * @param {() => void} [config.onSync]
     */
    constructor(config) {
        this.#config = config;
    }

    /** @type {object} */
    #config;

    /**
     * @returns {() => void} disconnect
     */
    connect() {
        if (this.#connected) {
            return () => this.disconnect();
        }

        this.#connected = true;
        this.resync();

        return () => this.disconnect();
    }

    disconnect() {
        this.#unwatchTargets();
        this.#connected = false;
    }

    resync() {
        const {
            host,
            internals,
            role,
            resolveRefs,
            controls = [],
            focusable = true,
            onRefsChange,
            onSync,
        } = this.#config;

        this.#unwatchTargets();

        const refs = resolveRefs?.() ?? {
            labelElements: this.#config.labelElements ?? [],
            descriptionElements: this.#config.descriptionElements ?? [],
        };

        this.#labelElements = refs.labelElements.filter(Boolean);
        this.#descriptionElements = refs.descriptionElements.filter(Boolean);

        const { light: lightLabels, shadow: shadowLabels } = partitionByRoot(this.#labelElements);
        const { light: lightDescriptions, shadow: shadowDescriptions } = partitionByRoot(
            this.#descriptionElements
        );

        const preparedLightLabels = prepareRefTargets(lightLabels);
        const preparedShadowLabels = prepareRefTargets(shadowLabels);
        const preparedLightDescriptions = prepareRefTargets(lightDescriptions);
        const preparedShadowDescriptions = prepareRefTargets(shadowDescriptions);

        const isCombobox = controls.length > 0;
        const listbox = controls[0] ?? null;

        if (focusable || isCombobox) {
            host.setAttribute('tabindex', '0');
        } else {
            host.removeAttribute('tabindex');
        }

        if (isCombobox) {
            host.setAttribute('aria-haspopup', 'listbox');
        }

        if (!SUPPORTS_ELEMENT_REFS) {
            host.setAttribute('role', role);
            host.removeAttribute('aria-label');
            host.removeAttribute('aria-description');

            if (listbox) {
                ensureFallbackId(listbox, 'listbox');
                host.setAttribute('aria-controls', listbox.id);
            }

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
        } else {
            host.removeAttribute('role');
            host.removeAttribute('aria-controls');
            host.removeAttribute('aria-labelledby');
            host.removeAttribute('aria-describedby');

            internals.role = role;

            if (listbox) {
                internals.ariaControlsElements = [listbox];
            }

            internals.ariaLabelledByElements = preparedShadowLabels;
            internals.ariaDescribedByElements = preparedShadowDescriptions;
            host.ariaLabelledByElements = preparedLightLabels;
            host.ariaDescribedByElements = preparedLightDescriptions;

            if (preparedShadowLabels.length || preparedShadowDescriptions.length) {
                const isMixedLabels =
                    preparedLightLabels.length > 0 && preparedShadowLabels.length > 0;
                const isMixedDescriptions =
                    preparedLightDescriptions.length > 0 && preparedShadowDescriptions.length > 0;
                mirrorShadowAccessibleName(
                    internals,
                    isMixedLabels ? [] : preparedShadowLabels,
                    isMixedDescriptions ? [] : preparedShadowDescriptions
                );
            } else {
                internals.ariaLabel = null;
                if ('ariaDescription' in internals) {
                    internals.ariaDescription = null;
                }
            }
        }

        this.#unwatchTargets = watchRefTargets(
            [...this.#labelElements, ...this.#descriptionElements],
            () => this.resync()
        );

        onRefsChange?.({
            labelElements: this.#labelElements,
            descriptionElements: this.#descriptionElements,
        });
        onSync?.();
    }

    getRefs() {
        return {
            labelElements: this.#labelElements,
            descriptionElements: this.#descriptionElements,
        };
    }
}

/**
 * @deprecated Use SplitSurfaceAriaController instead.
 */
export function syncHostFieldAriaRefs(
    host,
    internals,
    role,
    labelElements = [],
    descriptionElements = [],
    options = {}
) {
    const controller = new SplitSurfaceAriaController({
        host,
        internals,
        role,
        labelElements,
        descriptionElements,
        resolveRefs: options.resolveRefs,
        focusable: options.focusable,
    });

    return () => controller.resync();
}

/**
 * @deprecated Use SplitSurfaceAriaController with controls option instead.
 */
export function syncAriaElementRefs(
    host,
    internals,
    listbox,
    labelElements = [],
    descriptionElements = []
) {
    const controller = new SplitSurfaceAriaController({
        host,
        internals,
        role: 'combobox',
        labelElements,
        descriptionElements,
        controls: [listbox],
    });

    return () => controller.resync();
}
