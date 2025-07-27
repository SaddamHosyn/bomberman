/**
 * @fileoverview Simple App class for mini-framework
 * @version 0.0.1
 * @author Sagyn, Saddam Hussain, Ejmilli, Chan
 */

import { State, globalStorage } from "./State.js";
import { updateDom } from "./VDom.js";
import { addRoute, executeRoute } from "./Routing.js";

/**
 * Simple App class
 */
class App {
    constructor(rootSelector = "#app") {
        this.rootElement = null;
        this.rootSelector = rootSelector;
        this.renderFunction = null;
        this.isInitialized = false;
    }

    /**
     * Set the main render function
     */
    setRenderFunction(renderFn) {
        if (typeof renderFn === "function") {
            this.renderFunction = renderFn;
            globalStorage.setUpdateCallback(() => this.render());
        }
        return this;
    }

    /**
     * Add a route
     */
    addRoute(path, handler) {
        addRoute(path, handler);
        return this;
    }

    /**
     * Initialize the app
     */
    init() {
        if (this.isInitialized) return this;

        // Find root element
        this.rootElement = document.querySelector(this.rootSelector);
        if (!this.rootElement) {
            console.error(`Root element "${this.rootSelector}" not found`);
            return this;
        }

        // Set up routing
        window.addEventListener("hashchange", () => {
            executeRoute(window.location.hash);
        });

        // Execute initial route
        executeRoute(window.location.hash || "#/");

        this.isInitialized = true;
        this.render();
        return this;
    }

    /**
     * Render the app
     */
    render() {
        if (this.renderFunction && this.rootElement) {
            const vdom = this.renderFunction();
            updateDom(this.rootElement, Array.isArray(vdom) ? vdom : [vdom]);
        }
    }

    /**
     * Get current state
     */
    getState() {
        return globalStorage.getState();
    }

    /**
     * Update state
     */
    setState(newState, triggerUpdate = true) {
        return globalStorage.setState(newState, triggerUpdate);
    }
}

/**
 * Create a new App
 */
export function createApp(rootSelector = "#app") {
    return new App(rootSelector);
}

export { App };
