import { postMessage, onMessage } from '../shared/utils/messaging.js';
import { getById, setInnerHTML, addClasses, removeClasses } from '../shared/utils/dom.js';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Request initial data
  postMessage('checkUsage');

  // Set up event listeners
  setupEventListeners();

  // Set up message listeners
  onMessage({
    updateUsage: handleUpdateUsage
  });
});

function setupEventListeners() {
  // Action Cards
  const actions = [
    { id: 'action-diagram', command: 'generateDiagram' },
    { id: 'action-infographic', command: 'createInfographic' },
    { id: 'action-image', command: 'generateImage' },
    { id: 'action-history', command: 'viewHistory' }
  ];

  actions.forEach(({ id, command }) => {
    const element = getById(id);
    if (element) {
      element.addEventListener('click', () => {
        postMessage(command);
      });
    }
  });

  // Quick Links
  const settingsLink = getById('link-settings');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      postMessage('openSettings');
    });
  }
}

function handleUpdateUsage(usage) {
  const progressBar = getById('usage-progress');
  const progressFill = getById('usage-fill');
  const usageText = getById('usage-text');
  const limitText = getById('usage-limit');
  const badgeContainer = getById('subscription-badge');

  if (!usage) return;

  // Update subscription status
  if (usage.subscribed) {
    badgeContainer.innerHTML = '<span class="badge badge-success">Pro</span>';
    limitText.textContent = 'Unlimited';
    if (progressBar) progressBar.style.display = 'none';
    usageText.textContent = `${usage.diagramsCreated} diagrams created`;
  } else {
    badgeContainer.innerHTML = '<span class="badge badge-secondary">Free</span>';
    limitText.textContent = `${usage.freeLimit} limit`;

    // Update progress bar
    const percentage = Math.min(100, (usage.diagramsCreated / usage.freeLimit) * 100);
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;

      // Color coding
      removeClasses(progressFill, 'bg-warning', 'bg-error');
      if (percentage >= 90) {
        addClasses(progressFill, 'bg-error');
      } else if (percentage >= 70) {
        addClasses(progressFill, 'bg-warning');
      }
    }

    usageText.textContent = `${usage.diagramsCreated} / ${usage.freeLimit}`;
  }
}
