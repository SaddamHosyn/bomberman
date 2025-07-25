/**
 * @fileoverview Simple Virtual DOM for mini-framework
 * 
 * WHAT IS VIRTUAL DOM?
 * Virtual DOM is like making a blueprint before building a house:
 * 
 * 1. Instead of directly changing HTML on the webpage (slow and messy)
 * 2. We first create a "virtual" copy in JavaScript (fast and clean)
 * 3. Then we figure out what needs to change
 * 4. Finally we update only what's different on the real webpage
 * 
 * WHY IS THIS GOOD?
 * - Faster: We don't rebuild the whole page every time
 * - Cleaner: We can describe what we want, not how to build it
 * - Predictable: Same input always gives same output
 * 
 * HOW IT WORKS:
 * createElement() → createRealNode() → updateDom()
 * (make plan)  →  (build element)  →  (put on page)
 */

// Import specialized todo list update functions
import { updateTodoList } from './TodoDomUpdater.js';

/**
 * Create a virtual DOM element - this makes a "blueprint" of an HTML element
 * 
 * Example: createElement('div', {className: 'my-class'}, 'Hello World')
 * Creates: { tag: 'div', attrs: {className: 'my-class'}, children: ['Hello World'] }
 * 
 * This blueprint will later become: <div class="my-class">Hello World</div>
 */
export function createElement(tag, attrs = {}, ...children) {
    return {
        tag,           // What HTML tag? (div, p, h1, etc.)
        attrs: attrs || {},  // What properties? (class, id, onclick, etc.)
        children: children.flat().filter(child => child != null)  // What goes inside?
    };
}

/**
 * Create a real DOM element from virtual DOM blueprint
 * 
 * This is where we take our "blueprint" and actually build the real HTML element
 * that goes on the webpage. Like turning architectural plans into an actual house.
 */
export function createRealNode(vnode) {
    // Step 1: Handle simple text (like "Hello World")
    if (typeof vnode === 'string' || typeof vnode === 'number') {
        return document.createTextNode(String(vnode));
    }
    
    // Step 2: Create the HTML element (like <div>, <p>, <h1>)
    const element = document.createElement(vnode.tag);
    
    // Step 3: Add all the properties (class, id, onclick, etc.)
    Object.keys(vnode.attrs).forEach(key => {
        if (key.startsWith('on') && typeof vnode.attrs[key] === 'function') {
            // Handle events like onclick, onchange
            const eventType = key.slice(2).toLowerCase(); // 'onclick' becomes 'click'
            element.addEventListener(eventType, vnode.attrs[key]);
        } else if (key === 'className') {
            // Handle CSS classes
            element.className = vnode.attrs[key];
        } else if (key === 'htmlFor') {
            // Handle label htmlFor attribute (convert to 'for')
            element.setAttribute('for', vnode.attrs[key]);
        } else if (key === 'style' && typeof vnode.attrs[key] === 'object') {
            // Handle inline styles
            Object.assign(element.style, vnode.attrs[key]);
        } else if (key === 'checked') {
            // Handle checkbox checked state properly
            element.checked = vnode.attrs[key];
        } else if (key === 'value') {
            // Handle input values properly
            element.value = vnode.attrs[key];
        } else if (key === 'autofocus') {
            // Handle autofocus properly
            if (vnode.attrs[key]) {
                setTimeout(() => element.focus(), 0);
            }
        } else {
            // Handle regular attributes like id, placeholder, etc.
            element.setAttribute(key, vnode.attrs[key]);
        }
    });
    
    // Step 4: Add all the children (things that go inside this element)
    vnode.children.forEach(child => {
        element.appendChild(createRealNode(child)); // Recursive: build each child
    });
    
    return element; // Return the finished HTML element
}

/**
 * Update the DOM with new virtual DOM
 * 
 * This is the main function that updates what you see on the webpage.
 * It takes the new "blueprints" and rebuilds the webpage to match.
 * 
 * Think of it like: "Here's the new plan for how the page should look - make it happen!"
 */
export function updateDom(container, newVNodes) {
    // Make sure we have an array to work with
    const vNodeArray = Array.isArray(newVNodes) ? newVNodes : [newVNodes];
    
    // Get existing children
    const existingChildren = Array.from(container.children);
    
    // Try intelligent diffing first
    if (existingChildren.length === vNodeArray.length) {
        let canUpdateInPlace = true;
        
        // Check if we can update in place by comparing top-level structure
        for (let i = 0; i < vNodeArray.length; i++) {
            const vnode = vNodeArray[i];
            const existing = existingChildren[i];
            
            if (!vnode || !existing || 
                existing.tagName.toLowerCase() !== vnode.tag.toLowerCase() ||
                existing.className !== (vnode.attrs?.className || '')) {
                canUpdateInPlace = false;
                break;
            }
        }
        
        if (canUpdateInPlace) {
            // Update each element in place
            vNodeArray.forEach((vnode, index) => {
                if (vnode) {
                    updateElementInPlace(existingChildren[index], vnode);
                }
            });
            return;
        }
    }
    
    // Fallback: clear everything and rebuild from scratch
    container.innerHTML = '';
    
    // Build each new element and add it to the page
    vNodeArray.forEach(vnode => {
        if (vnode) {
            container.appendChild(createRealNode(vnode)); // Turn blueprint into real HTML
        }
    });
}

/**
 * Update an existing DOM element in place with new virtual DOM data
 */
function updateElementInPlace(element, vnode) {
    // Special handling for todo list container - use specialized update logic
    if (element.tagName === 'UL' && element.classList.contains('todo-list')) {
        updateTodoList(element, vnode, createRealNode);
        return;
    }
    
    // Update basic attributes
    if (vnode.attrs) {
        Object.keys(vnode.attrs).forEach(key => {
            if (key.startsWith('on')) {
                // Skip event handlers - they're already attached
                return;
            } else if (key === 'className') {
                if (element.className !== vnode.attrs[key]) {
                    element.className = vnode.attrs[key];
                }
            } else if (key === 'style' && typeof vnode.attrs[key] === 'string') {
                element.setAttribute('style', vnode.attrs[key]);
            }
        });
    }
    
    // Update text content for simple elements
    if (vnode.children.length === 1 && typeof vnode.children[0] === 'string') {
        if (element.textContent !== vnode.children[0]) {
            element.textContent = vnode.children[0];
        }
    } else if (vnode.children.length > 0) {
        // For complex children, recursively update or rebuild
        const existingChildElements = Array.from(element.children);
        
        if (existingChildElements.length === vnode.children.length) {
            // Try to update children in place
            vnode.children.forEach((childVNode, index) => {
                const existingChild = existingChildElements[index];
                if (existingChild && typeof childVNode === 'object' && 
                    existingChild.tagName.toLowerCase() === childVNode.tag.toLowerCase()) {
                    updateElementInPlace(existingChild, childVNode);
                } else {
                    // Replace this child
                    element.replaceChild(createRealNode(childVNode), existingChild);
                }
            });
        } else {
            // Different number of children, rebuild
            element.innerHTML = '';
            vnode.children.forEach(child => {
                element.appendChild(createRealNode(child));
            });
        }
    }
}

/**
 * JSX-like helper
 */
export function h(tag, props, ...children) {
    return createElement(tag, props, ...children);
}

/**
 * Compatibility function for TodoApp
 */
export function createVirtualElement(tag, attrs = {}, textContent = "", children = []) {
    if (textContent && children.length === 0) {
        return createElement(tag, attrs, textContent);
    }
    if (children.length > 0) {
        return createElement(tag, attrs, ...children);
    }
    return createElement(tag, attrs);
}

/**
 * Focus an element by selector
 */
export function focusElement(selector, position = 'start') {
    setTimeout(() => {
        const element = document.querySelector(selector);
        if (element) {
            element.focus();
            
            if (element.type === 'text' || element.type === 'textarea') {
                if (position === 'end') {
                    element.setSelectionRange(element.value.length, element.value.length);
                } else {
                    element.setSelectionRange(0, 0);
                }
            }
        }
    }, 0);
}