/**
 * Theme Utilities
 * Detect and respond to VS Code theme changes
 */

/**
 * Get the current theme kind
 * @returns {'light'|'dark'} Theme kind
 */
export function getThemeKind() {
  const body = document.body;
  const themeKind = body.getAttribute('data-vscode-theme-kind');

  return themeKind === 'vscode-dark' ||
         themeKind === 'vscode-high-contrast'
    ? 'dark'
    : 'light';
}

/**
 * Check if current theme is dark
 * @returns {boolean} True if dark theme
 */
export function isDarkTheme() {
  return getThemeKind() === 'dark';
}

/**
 * Set up theme change observer
 * @param {Function} callback - Function to call when theme changes
 * @returns {MutationObserver} Observer instance
 */
export function onThemeChange(callback) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-vscode-theme-kind') {
        const newTheme = getThemeKind();
        callback(newTheme);
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-vscode-theme-kind']
  });

  return observer;
}

/**
 * Add theme class to an element
 * @param {HTMLElement} element - Element to add class to
 */
export function applyThemeClass(element) {
  const theme = getThemeKind();
  element.classList.remove('theme-light', 'theme-dark');
  element.classList.add(`theme-${theme}`);
}

/**
 * Get theme-specific value
 * @param {*} lightValue - Value for light theme
 * @param {*} darkValue - Value for dark theme
 * @returns {*} Theme-specific value
 */
export function getThemeValue(lightValue, darkValue) {
  return isDarkTheme() ? darkValue : lightValue;
}
