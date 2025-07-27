/**
 * @fileoverview DOM manipulation and virtual DOM utilities for the mini-framework
 * @version 0.0.1
 * @author The Last of the Mohicans 2
 */

import { globalStorage } from "./State.js";

/**
 * Creates a virtual DOM element object
 * @param {string} tag - HTML tag name for the element
 * @param {Object} attributes - Object containing element attributes and event handlers
 * @param {string} [innerText] - Text content for the element
 * @param {Array<Object>} children - Array of child virtual elements
 * @returns {Object} Virtual element object with tag, attributes, innerText, and children
 * @throws {Error} Throws if any parameter validation fails
 * @example
 * const vElement = createVirtualElement('div', { class: 'container' }, 'Hello', []);
 */
export function createVirtualElement(tag, attributes, innerText, children) {
  // More thorough check later (TODO)
  if (!tag || typeof tag !== "string") {
    throw new Error("Error: tag is not a string");
  }
  if (!attributes || typeof attributes !== "object" || attributes === null) {
    throw new Error("Error: attributes are not an object");
  }
  if (innerText && typeof innerText !== "string") {
    throw new Error("Error: innerText is not a string");
  }
  if (!children || !Array.isArray(children)) {
    throw new Error("Error: children is not an array");
  }
  for (const child of children) {
    if (
      typeof child !== "object" ||
      child === null ||
      typeof child.tag !== "string" ||
      !(child.attributes && child.attributes instanceof Object) ||
      !child.children ||
      !Array.isArray(child.children)
    ) {
      console.log(typeof child, child);
      console.log(typeof child.children, child.children);
      throw new Error(
        "Error: each child must be a virtual element with tag, attributes, and children:",
        children
      );
    }
  }

  return {
    tag: tag,
    attributes: attributes,
    innerText: innerText,
    children: children,
  };
}


/**
 * Converts a virtual element object to an actual HTML DOM element
 * @param {Object} elem - Virtual element object with tag, attributes, innerText, and children
 * @param {string} elem.tag - HTML tag name
 * @param {Object} elem.attributes - Element attributes and event handlers
 * @param {string} [elem.innerText] - Text content
 * @param {Array<Object>} elem.children - Array of child virtual elements
 * @returns {HTMLElement} Created DOM element with all attributes and children applied
 * @throws {Error} Throws if elem is not an object or attributes are invalid
 */
export function elementToHtmlElement(elem) {
  if (typeof elem !== "object") {
    throw new Error(`Error: ${elem} is not an object`);
  }
  // Fix: use elem.tag instead of elem.state.tag
  const returnElement = document.createElement(elem.tag);

  if (elem.innerText) {
    returnElement.innerText = elem.innerText;
  }

  if (
    !elem.attributes ||
    typeof elem.attributes !== "object" ||
    elem.attributes === null ||
    elem.attributes instanceof NamedNodeMap ||
    Array.isArray(elem.attributes)
  ) {
    throw new Error("Error: elem.attributes is not a plain object");
  }

  for (const [attrName, attrValue] of Object.entries(elem.attributes)) {
    // Check if the attribute is an event handler
    if (attrName.startsWith("on") && typeof attrValue === "function") {
      // Handle event listeners
      const eventName = attrName.substring(2).toLowerCase();
      returnElement.addEventListener(eventName, attrValue);
    } else if (attrName === "checked") {
      // Special handling for checkbox checked state
      if (attrValue) {
        returnElement.checked = true;
        returnElement.setAttribute("checked", "checked");
      } else {
        returnElement.checked = false;
        returnElement.removeAttribute("checked");
      }
    } else if (attrValue !== null && attrValue !== undefined) {
      // Handle regular attributes
      returnElement.setAttribute(attrName, attrValue.toString());
    }
  }

  elem.children.forEach((child) => {
    returnElement.appendChild(elementToHtmlElement(child));
  });
  return returnElement;
}

/**
 * Updates the DOM by replacing all content with new virtual elements
 * @param {HTMLElement} [topElement=document.body] - Root element to update
 * @param {Array<Object>} attachElements - Array of virtual elements to render
 * @throws {Error} Throws if attachElements is not an array or contains invalid elements
 */
export function updateDom(topElement = document.body, attachElements) {
  if (!attachElements || !Array.isArray(attachElements)) {
    throw new Error("Error: attachElements is not an array");
  }
  for (const element of attachElements) {
    if (typeof element !== "object") {
      throw new Error("Error: element is not an object");
    }
  }

  globalStorage.setState(
    {
      vDOM: attachElements,
      topElement: topElement,
    },
    false
  );
  topElement.innerHTML = "";
  for (const element of attachElements) {
    topElement.appendChild(elementToHtmlElement(element));
  }
}

/**
 * Finds an element using any CSS selector
 * @param {string} selector - CSS selector string
 * @param {Element} [rootElement=null] - Root element to search within, defaults to app root
 * @returns {Element|null} Found element or null if not found
 */
export function findElement(selector, rootElement = null) {
  const searchRoot =
    rootElement || globalStorage.getState().topElement || document.body;
  return searchRoot.querySelector(selector);
}

/**
 * Sets focus on an element with optional cursor positioning
 * @param {string} selector - CSS selector for the element to focus
 * @param {string} [cursorPosition='default'] - Cursor position: 'default', 'end', or 'select'
 * @returns {boolean} True if element was found and focused, false otherwise
 */
export function focusElement(selector, cursorPosition = "default") {
  const element = findElement(selector);
  if (element && typeof element.focus === "function") {
    element.focus();

    // Handle cursor positioning for text inputs
    if (
      cursorPosition === "end" &&
      element.type === "text" &&
      typeof element.setSelectionRange === "function"
    ) {
      const length = element.value.length;
      element.setSelectionRange(length, length);
    } else if (
      cursorPosition === "select" &&
      typeof element.select === "function"
    ) {
      element.select();
    }

    return true;
  }
  return false;
}
