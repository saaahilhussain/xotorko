'use strict';

(function () {
  const form = document.getElementById('analyze-form');
  const textarea = document.getElementById('message');
  const button = document.getElementById('submit');
  const result = document.getElementById('result');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      result.textContent = 'Please paste a message first.';
      textarea.focus();
      return;
    }
    button.disabled = true;
    result.textContent = 'Checking...';
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      result.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      result.textContent = 'Could not reach the server. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
})();
