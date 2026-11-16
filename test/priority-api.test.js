'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { initialTickets } = require('../src/store');

async function withServer(run) {
  const server = createApp({ seed: initialTickets(), testMode: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('GET /api/tickets?priority=high returns only high-priority tickets', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tickets?priority=high`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.total, 2);
    assert.deepEqual(body.items.map((ticket) => ticket.id), [4, 1]);
    assert.ok(body.items.every((ticket) => ticket.priority === 'high'));
  });
});
