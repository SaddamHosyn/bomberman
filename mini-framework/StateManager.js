/**
 * @fileoverview Simple state management for mini-framework
 * @version 0.0.1
 * @author Sagyn, Saddam Hussain, Ejmilli, Chan
 * 
 * WHAT IS THIS?
 * This is like a central storage box for your app's data.
 * Instead of passing data between components, we store it here
 * and any component can read or update it.
 * 
 * HOW IT WORKS:
 * 1. Store data: setState({ name: "John", age: 25 })
 * 2. Read data: getState() returns { name: "John", age: 25 }
 * 3. Listen for changes: subscribe(() => console.log("Data changed!"))
 * 4. Auto-update UI: When data changes, the page updates automatically
 */

/**
 * State class - Think of this as a smart storage box that:
 * - Holds your app's data (like user info, todo items, etc.)
 * - Tells everyone when the data changes
 * - Automatically updates the webpage when needed
 */
export class State {
    constructor(initialData = {}) {
        // The actual data storage - start with whatever data is provided
        this.state = { ...initialData };
        
        // List of functions to call when data changes (like notifications)
        this.changeListeners = [];
        
        // Special function to update the webpage when data changes
        this.uiUpdateFunction = null;
    }

    /**
     * Tell the state manager how to update the webpage
     * Example: setUpdateCallback(() => renderMyApp())
     */
    setUpdateCallback(updateFunction) {
        this.uiUpdateFunction = updateFunction;
    }

    /**
     * Get a copy of the current data
     * Returns a copy so external code can't accidentally break our data
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Update the stored data with new information
     * Example: setState({ name: "Alice" }) adds/updates the name
     * 
     * @param {Object} newData - The new data to add/update
     * @param {boolean} shouldTriggerUpdate - Whether to update the UI and notify listeners
     */
    setState(newData, shouldTriggerUpdate = true) {
        // Only proceed if we got valid data
        if (typeof newData === 'object' && newData !== null) {
            // Merge new data with existing data (new data overwrites old)
            this.state = { ...this.state, ...newData };
            
            // If requested, notify everyone about the change
            if (shouldTriggerUpdate) {
                // Step 1: Call all the notification functions
                this.changeListeners.forEach(listenerFunction => {
                    listenerFunction(this.state);
                });
                
                // Step 2: Update the webpage if we have an update function
                if (this.uiUpdateFunction) {
                    this.uiUpdateFunction();
                }
            }
        }
        return this.state;
    }

    /**
     * Add a function to be called whenever data changes
     * Example: subscribe((newData) => console.log("Data changed:", newData))
     */
    subscribe(listenerFunction) {
        if (typeof listenerFunction === 'function') {
            this.changeListeners.push(listenerFunction);
        }
    }
}

// Create one global state storage that the whole app can use
// This is like having one shared storage box for the entire application
export const globalStorage = new State({});