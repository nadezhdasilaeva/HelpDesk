'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { initialTickets } = require('../src/store');

async function withServer(run) {
  const server = createApp({ seed: initialTickets(), testMode: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('GET /api/health reports a healthy service', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('GET /api/tickets without filters returns the complete list', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tickets`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.total, 4);
    assert.equal(body.items.length, 4);
  });
});

test('existing status and category filters still work together', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tickets?status=resolved&category=network`);
    const body = await response.json();

    assert.equal(body.total, 1);
    assert.equal(body.items[0].id, 4);
  });
});

test('search filter continues to work', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tickets?search=VPN`);
    const body = await response.json();

    assert.equal(body.total, 1);
    assert.equal(body.items[0].id, 1);
  });
});

test('priority filter combines with search, status and category using AND', async () => {
  await withServer(async (baseUrl) => {
    const query = new URLSearchParams({
      search: 'Wi-Fi',
      status: 'resolved',
      category: 'network',
      priority: 'high'
    });
    const response = await fetch(`${baseUrl}/api/tickets?${query}`);
    const body = await response.json();

    assert.equal(body.total, 1);
    assert.deepEqual(body.items.map((ticket) => ticket.id), [4]);
    assert.ok(body.items.every((ticket) => ticket.priority === 'high'));
  });
});

test('POST /api/tickets creates a valid ticket and rejects invalid input', async () => {
  await withServer(async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Новый монитор',
        description: 'На рабочем месте не включается монитор',
        category: 'hardware',
        priority: 'medium'
      })
    });
    const createdBody = await created.json();

    assert.equal(created.status, 201);
    assert.equal(createdBody.ticket.id, 5);
    assert.equal(createdBody.ticket.priority, 'medium');

    const rejected = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x' })
    });
    assert.equal(rejected.status, 400);
    assert.ok((await rejected.json()).errors);
  });
});

test('PATCH /api/tickets/:id/status allows valid transitions and rejects invalid ones', async () => {
  await withServer(async (baseUrl) => {
    const changed = await fetch(`${baseUrl}/api/tickets/1/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).ticket.status, 'in_progress');

    const conflict = await fetch(`${baseUrl}/api/tickets/1/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'new' })
    });
    assert.equal(conflict.status, 409);
  });
});

test('empty priority value leaves the list unfiltered by priority', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tickets?priority=`);
    const body = await response.json();

    assert.equal(body.total, 4);
  });
});
