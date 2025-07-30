/**
 * @fileoverview Todo-specific DOM update operations for Virtual DOM
 * @version 0.0.1
 * @author Sagyn, Saddam Hussain, Ejmilli, Chan
 * 
 * WHAT IS THIS?
 * This file contains specialized logic for efficiently updating todo list items.
 * Instead of rebuilding the entire todo list every time, we smart-update only
 * the items that actually changed, which makes the app much faster.
 * 
 * HOW IT WORKS:
 * 1. Compare existing todo items with new ones by their ID
 * 2. Remove items that no longer exist
 * 3. Update items that changed
 * 4. Add new items where needed
 * 5. Keep everything in the correct order
 */

/**
 * Smart update for todo list - only updates changed items by ID
 * This is much faster than rebuilding the entire list every time
 * 
 * @param {HTMLElement} ul - The actual <ul> element in the DOM
 * @param {Object} vnode - The virtual node representing the new todo list
 * @param {Function} createRealNode - Function to create real DOM nodes from virtual nodes
 */
export function updateTodoList(ul, vnode, createRealNode) {
    // Get current todo items from the webpage and new ones from our virtual DOM
    const existingItems = Array.from(ul.children); // Current <li> elements
    const newItems = vnode.children; // New virtual <li> elements
    
    // Create maps for efficient lookup - like making an index for quick searching
    const existingItemsById = new Map();
    existingItems.forEach(li => {
        const todoId = li.getAttribute('data-id');
        if (todoId) {
            existingItemsById.set(todoId, li);
        }
    });
    
    const newItemsById = new Map();
    newItems.forEach(virtualListItem => {
        const todoId = virtualListItem.attrs?.['data-id'];
        if (todoId) {
            newItemsById.set(todoId, virtualListItem);
        }
    });
    
    // Step 1: Remove todo items that no longer exist
    existingItemsById.forEach((listItem, todoId) => {
        if (!newItemsById.has(todoId)) {
            // Check if element is still in the DOM before removing
            if (listItem.parentNode) {
                listItem.remove();
            }
        }
    });
    
    // Step 2: Update existing items and add new ones
    newItems.forEach((virtualListItem, targetIndex) => {
        const todoId = virtualListItem.attrs?.['data-id'];
        if (!todoId) return;
        
        const existingListItem = existingItemsById.get(todoId);
        
        if (existingListItem) {
            // Update this specific todo item
            updateTodoItem(existingListItem, virtualListItem, createRealNode);
            
            // Make sure it's in the correct position
            const currentPosition = Array.from(ul.children).indexOf(existingListItem);
            if (currentPosition !== targetIndex) {
                if (targetIndex >= ul.children.length) {
                    ul.appendChild(existingListItem);
                } else {
                    ul.insertBefore(existingListItem, ul.children[targetIndex]);
                }
            }
        } else {
            // Create brand new item
            const newListItem = createRealNode(virtualListItem);
            if (targetIndex >= ul.children.length) {
                ul.appendChild(newListItem);
            } else {
                ul.insertBefore(newListItem, ul.children[targetIndex]);
            }
        }
    });
}

/**
 * Update a specific todo item (li element) in place
 * This handles things like marking items as completed, editing mode, etc.
 * 
 * @param {HTMLElement} li - The actual list item element
 * @param {Object} vli - The virtual list item with new data
 * @param {Function} createRealNode - Function to create real DOM nodes
 */
export function updateTodoItem(li, vli, createRealNode) {
    const newClassName = vli.attrs?.className || '';
    const currentClassName = li.className;
    
    // Update CSS classes (this handles editing/completed states)
    if (currentClassName !== newClassName) {
        li.className = newClassName;
    }
    
    // Check if the todo item switched between editing mode and normal mode
    const wasInEditingMode = currentClassName.includes('editing');
    const isInEditingMode = newClassName.includes('editing');
    
    if (wasInEditingMode !== isInEditingMode) {
        // Editing state changed - need to rebuild the content completely
        li.innerHTML = '';
        vli.children.forEach(child => {
            li.appendChild(createRealNode(child));
        });
        
        // If we just entered editing mode, focus and select the edit input
        if (isInEditingMode) {
            requestAnimationFrame(() => {
                const editInput = li.querySelector('.edit');
                if (editInput) {
                    editInput.focus();
                    editInput.select();
                }
            });
        }
    } else {
        // Same editing state - just update the specific parts that might have changed
        updateTodoItemContent(li, vli);
    }
}

/**
 * Update specific parts of a todo item without rebuilding everything
 * This is for small changes like updating the text or checkbox state
 * 
 * @param {HTMLElement} li - The list item element
 * @param {Object} vli - The virtual list item with new data
 */
export function updateTodoItemContent(li, vli) {
    // Update the todo text if it changed
    const label = li.querySelector('label');
    const newLabelText = findLabelTextInVNode(vli);
    if (label && newLabelText && label.textContent !== newLabelText) {
        label.textContent = newLabelText;
    }
    
    // Update the checkbox (completed/not completed) if it changed
    const checkbox = li.querySelector('.toggle');
    const newCheckedState = findCheckboxStateInVNode(vli);
    if (checkbox && checkbox.checked !== newCheckedState) {
        checkbox.checked = newCheckedState;
    }
}

/**
 * Helper function to find the text content of a label in the virtual DOM tree
 * This searches through the virtual DOM structure to find the todo text
 * 
 * @param {Object} vnode - Virtual DOM node to search through
 * @returns {string|null} - The label text or null if not found
 */
export function findLabelTextInVNode(vnode) {
    // If this is a label element with text content, return it
    if (vnode.tag === 'label' && vnode.children.length > 0) {
        return vnode.children[0];
    }
    
    // Otherwise, search through all child elements
    if (vnode.children) {
        for (const child of vnode.children) {
            if (typeof child === 'object') {
                const result = findLabelTextInVNode(child);
                if (result) return result;
            }
        }
    }
    return null;
}

/**
 * Helper function to find the checkbox state in the virtual DOM tree
 * This searches for input[type="checkbox"] elements and returns their checked state
 * 
 * @param {Object} vnode - Virtual DOM node to search through
 * @returns {boolean} - Whether the checkbox should be checked
 */
export function findCheckboxStateInVNode(vnode) {
    // If this is a checkbox input, return its checked state
    if (vnode.tag === 'input' && vnode.attrs?.type === 'checkbox') {
        return !!vnode.attrs.checked;
    }
    
    // Otherwise, search through all child elements
    if (vnode.children) {
        for (const child of vnode.children) {
            if (typeof child === 'object') {
                const result = findCheckboxStateInVNode(child);
                if (result !== null) return result;
            }
        }
    }
    return false;
}
