/**
 * DOM Utilities
 * Helper functions for DOM manipulation
 */

/**
 * Create an element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {...(string|HTMLElement)} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);

  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  // Add children
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      element.appendChild(child);
    } else if (child) {
      element.appendChild(document.createTextNode(String(child)));
    }
  });

  return element;
}

/**
 * Show an element
 * @param {HTMLElement} element - Element to show
 * @param {string} display - Display value (default: 'block')
 */
export function show(element, display = 'block') {
  element.style.display = display;
}

/**
 * Hide an element
 * @param {HTMLElement} element - Element to hide
 */
export function hide(element) {
  element.style.display = 'none';
}

/**
 * Toggle element visibility
 * @param {HTMLElement} element - Element to toggle
 * @param {string} display - Display value when shown
 */
export function toggle(element, display = 'block') {
  if (element.style.display === 'none') {
    show(element, display);
  } else {
    hide(element);
  }
}

/**
 * Add multiple classes to an element
 * @param {HTMLElement} element - Target element
 * @param {...string} classes - Classes to add
 */
export function addClasses(element, ...classes) {
  element.classList.add(...classes);
}

/**
 * Remove multiple classes from an element
 * @param {HTMLElement} element - Target element
 * @param {...string} classes - Classes to remove
 */
export function removeClasses(element, ...classes) {
  element.classList.remove(...classes);
}

/**
 * Toggle a class on an element
 * @param {HTMLElement} element - Target element
 * @param {string} className - Class to toggle
 * @param {boolean} force - Force add/remove
 */
export function toggleClass(element, className, force) {
  element.classList.toggle(className, force);
}

/**
 * Set inner HTML safely (prevents XSS)
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content
 */
export function setInnerHTML(element, html) {
  // Basic XSS prevention - sanitize script tags
  const sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  element.innerHTML = sanitized;
}

/**
 * Get element by ID with type safety
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null
 */
export function getById(id) {
  return document.getElementById(id);
}

/**
 * Get elements by class name
 * @param {string} className - Class name
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement[]} Array of elements
 */
export function getByClass(className, parent = document) {
  return Array.from(parent.getElementsByClassName(className));
}

/**
 * Query selector with type safety
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null} Element or null
 */
export function query(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement[]} Array of elements
 */
export function queryAll(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Empty an element (remove all children)
 * @param {HTMLElement} element - Element to empty
 */
export function empty(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Replace an element's children
 * @param {HTMLElement} element - Parent element
 * @param {...(string|HTMLElement)} children - New children
 */
export function replaceChildren(element, ...children) {
  empty(element);
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      element.appendChild(child);
    }
  });
}

/**
 * Append multiple children to an element
 * @param {HTMLElement} parent - Parent element
 * @param {...(string|HTMLElement)} children - Children to append
 */
export function appendChildren(parent, ...children) {
  children.forEach(child => {
    if (typeof child === 'string') {
      parent.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      parent.appendChild(child);
    }
  });
}

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function
 */
export function on(element, event, handler) {
  element.addEventListener(event, handler);
  return () => element.removeEventListener(event, handler);
}

/**
 * Wait for DOM content to be loaded
 * @param {Function} callback - Function to call when ready
 */
export function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
