import { collectSlottedFieldRefs, watchSlottedFieldRefs } from './field-ref-watchers.js';
import { SplitSurfaceAriaController } from './split-surface-aria-controller.js';

/**
 * Keeps host ARIA refs in sync with label/description slotted from Light DOM.
 */
export class SlottedFieldAriaController {
    /** @type {SplitSurfaceAriaController | null} */
    #splitController = null;

    /** @type {ReturnType<typeof watchSlottedFieldRefs>} */
    #unwatchSlots = () => {};

    /**
     * @param {object} config
     * @param {HTMLElement} config.host
     * @param {ElementInternals} config.internals
     * @param {string} config.role
     * @param {string} [config.labelSlot]
     * @param {string} [config.helpSlot]
     * @param {boolean} [config.focusable]
     * @param {(refs: { labelElements: HTMLElement[], descriptionElements: HTMLElement[] }) => void} [config.onRefsChange]
     * @param {() => void} [config.onSync]
     */
    constructor(config) {
        this.#config = config;
    }

    /** @type {object} */
    #config;

    connect() {
        const {
            host,
            internals,
            role,
            labelSlot = 'label',
            helpSlot = 'help-text',
            focusable = true,
            onRefsChange,
            onSync,
        } = this.#config;

        this.#splitController = new SplitSurfaceAriaController({
            host,
            internals,
            role,
            focusable,
            resolveRefs: () => collectSlottedFieldRefs(host, { labelSlot, helpSlot }),
            onRefsChange,
            onSync,
        });

        this.#unwatchSlots = watchSlottedFieldRefs(
            host,
            () => this.#splitController?.resync(),
            { labelSlot, helpSlot }
        );

        this.#splitController.connect();

        return () => this.disconnect();
    }

    disconnect() {
        this.#unwatchSlots();
        this.#splitController?.disconnect();
        this.#splitController = null;
    }

    resync() {
        this.#splitController?.resync();
    }

    getRefs() {
        return this.#splitController?.getRefs() ?? { labelElements: [], descriptionElements: [] };
    }
}

/**
 * @deprecated Use SlottedFieldAriaController instead.
 */
export function establishSlottedFieldAriaSync(host, internals, role, options = {}) {
    const controller = new SlottedFieldAriaController({
        host,
        internals,
        role,
        ...options,
    });

    controller.connect();

    return {
        disconnect: () => controller.disconnect(),
        getRefs: () => controller.getRefs(),
        resync: () => controller.resync(),
    };
}
