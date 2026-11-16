'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

test('priority filter is available in the interface', () => {
  assert.match(html, /<label for="filter-priority">Приоритет<\/label>/);
  assert.match(html, /<select id="filter-priority" data-testid="priority-filter">/);
  assert.match(html, /<option value="">Все приоритеты<\/option>/);
  assert.match(html, /<option value="high">Высокий<\/option>/);
});

test('interface sends the selected priority and reloads on filter changes', () => {
  assert.match(app, /document\.querySelector\('#filter-priority'\)/);
  assert.match(app, /priority:\s*priorityFilter\.value/);
  assert.match(app, /\[search, statusFilter, categoryFilter, priorityFilter\]/);
});
