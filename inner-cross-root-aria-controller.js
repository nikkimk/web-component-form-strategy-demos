import { SUPPORTS_ELEMENT_REFS } from './aria-ref-utils.js';
import { watchRefTargets } from './field-ref-watchers.js';

/**
 * Wires a shadow inner control to Light DOM label/help (shadow → light only).
 * @see https://codepen.io/spectrum-css/pen/pvNEVda
 */
export class InnerCrossRootAriaController {
    /** @type {ReturnType<typeof watchRefTargets>} */
    #unwatchTargets = () => {};

    #labelElements = [];

    #descriptionElements = [];

    /**
     * @param {object} config
     * @param {HTMLElement | null} config.innerSurface
     * @param {() => { labelElements: HTMLElement[], descriptionElements: HTMLElement[] }} config.resolveRefs
     * @param {(refs: { labelElements: HTMLElement[], descriptionElements: HTMLElement[] }) => void} [config.onRefsChange]
     * @param {() => void} [config.onSync]
     */
    constructor(config) {
        this.#config = config;
    }

    /** @type {object} */
    #config;

    connect() {
        this.resync();
        return () => this.disconnect();
    }

    disconnect() {
        this.#unwatchTargets();
    }

    resync() {
        const { innerSurface, resolveRefs, onRefsChange, onSync } = this.#config;

        this.#unwatchTargets();

        const refs = resolveRefs();
        this.#labelElements = refs.labelElements.filter(Boolean);
        this.#descriptionElements = refs.descriptionElements.filter(Boolean);

        if (innerSurface && SUPPORTS_ELEMENT_REFS) {
            innerSurface.ariaLabelledByElements = this.#labelElements;
            innerSurface.ariaDescribedByElements = this.#descriptionElements;
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
 * @deprecated Use InnerCrossRootAriaController instead.
 */
export function wireInnerCrossRootAriaRefs(innerSurface, labelElements, descriptionElements) {
    if (!innerSurface || !SUPPORTS_ELEMENT_REFS) {
        return false;
    }

    innerSurface.ariaLabelledByElements = labelElements.filter(Boolean);
    innerSurface.ariaDescribedByElements = descriptionElements.filter(Boolean);
    return true;
}

/**
 * @deprecated Use InnerCrossRootAriaController instead.
 */
export function establishInnerCrossRootAriaSync(innerSurface, resolveRefs, refreshLog) {
    const controller = new InnerCrossRootAriaController({
        innerSurface,
        resolveRefs,
        onSync: refreshLog,
    });

    controller.connect();

    return () => controller.disconnect();
}
