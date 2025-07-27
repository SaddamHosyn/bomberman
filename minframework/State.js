/**
 * @fileoverview Simple state management for mini-framework
 * @version 0.0.1
 * @author Sagyn, Saddam Hussain, Ejmilli, Chan
 */

/**
 * Simple State class for managing application state
 */
export class State {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = [];
        this.updateCallback = null;
    }

    /**
     * Set the function to call when state updates
     */
    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Update state with new values
     */
    setState(newState, triggerUpdate = true) {
        if (typeof newState === 'object' && newState !== null) {
            this.state = { ...this.state, ...newState };
            
            if (triggerUpdate) {
                // Call all listeners
                this.listeners.forEach(listener => listener(this.state));
                
                // Trigger DOM update
                if (this.updateCallback) {
                    this.updateCallback();
                }
            }
        }
        return this.state;
    }

    /**
     * Add a listener for state changes
     */
    subscribe(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        }
    }
}

// Global state instance
export const globalStorage = new State({});
