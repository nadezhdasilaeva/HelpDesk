'use strict';
const { createApp } = require('../../src/app');

let server;
let base;

beforeEach(async () => {
  server = createApp({ seed: [] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health отвечает HTTP 200', async () => {
  const response = await fetch(`${base}/api/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('POST /api/tickets создает корректную заявку', async () => {
  const response = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Сбой принтера', description: 'Принтер в аудитории не отвечает',
      category: 'hardware', priority: 'medium'
    })
  });
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.ticket.id).toBe(1);
  expect(body.ticket.status).toBe('new');
});

// Добавьте проверки GET с фильтрами, некорректных запросов,
// запретных переходов статуса и последовательных запросов к API.



test('успешное создание и чтение того же обращения по GET', async () => {
  const payload = {
    title: ' Сбой VPN в корпусе ',
    description: 'Не удается подключиться к учебной сети',
    category: 'network',
    priority: 'high',
  };


  const created = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const createdBody = await created.json();

  expect(created.status).toBe(201);
  expect(createdBody.ticket).toMatchObject({
    title: 'Сбой VPN в корпусе',
    description: 'Не удается подключиться к учебной сети',
    category: 'network',
    priority: 'high',
    status: 'new',
  });
  const id = createdBody.ticket.id;
  expect(id).toBeDefined();

  const list = await fetch(`${base}/api/tickets`);
  const listBody = await list.json();

  expect(list.status).toBe(200);
  expect(listBody.total).toBe(1);
  expect(listBody.items).toHaveLength(1);

  const found = listBody.items.find((t) => t.id === id);
  expect(found).toBeDefined();
  expect(found).toEqual(createdBody.ticket);
  expect(found.status).toBe('new');
});


// Ошибка валидации и неизменность количества заявок после HTTP 400

test('ошибка валидации, количество заявок не изменилось', async () => {
  const beforeRes = await fetch(`${base}/api/tickets`);
  const beforeBody = await beforeRes.json();
  const beforeIds = beforeBody.items.map((t) => t.id);

  const res = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'abc',
      description: 'Не удается подключиться к учебной сети',
      category: 'unknown',
      priority: 'high',
    }),
  });
  const body = await res.json();

  expect(res.status).toBe(400);
  expect(body.errors).toEqual(
    expect.objectContaining({ title: expect.anything(), category: expect.anything() })
  );

  const afterRes = await fetch(`${base}/api/tickets`);
  const afterBody = await afterRes.json();
  expect(afterBody.items.map((t) => t.id)).toEqual(beforeIds);
});

// Комбинация search + status + category и ожидаемое количество записей

test('search + status + category одновременно сужают выборку (AND)', async () => {
  // 4 заявки
  const make = (data) => fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => r.json());

  const a = await make({ title: 'Ошибка в офисном пакете', description: 'При сохранении файла появляется ошибка', category: 'software', priority: 'medium' });
  const b = await make({ title: 'VPN не работает', description: 'Не получается подключиться', category: 'network', priority: 'medium' });
  const c = await make({ title: 'Мышь не работает', description: 'Не реагирует кнопка мыши в кабинете', category: 'hardware', priority: 'low' });
  const d = await make({title: 'WI-FI на этаже', description: 'Нет доступа к сети на третьем этаже', category: 'network', priority: 'high' });


  await fetch(`${base}/api/tickets/${b.ticket.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });


  const res = await fetch(
    `${base}/api/tickets?search=${encodeURIComponent('не работает')}&status=in_progress&category=network`
  );
  const body = await res.json();


  expect(res.status).toBe(200);
  expect(body.total).toBe(1);
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    id: b.ticket.id,
    status: 'in_progress',
    category: 'network',
  });
});


 // Запрет недопустимого перехода статуса через PATCH и ожидаемый HTTP 409

 test('new -> resolved запрещён ожидаемый HTTP 409, статус не изменился', async () => {
  // создать заявку
  const { ticket } = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'VPN не работает',
      description: 'Не удается подключиться к учебной сети',
      category: 'network',
      priority: 'high',
    }),
  }).then((r) => r.json());

  // попытка new -> resolved
  const res = await fetch(`${base}/api/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'resolved' }),
  });

  // статус в хранилище не изменился
  expect(res.status).toBe(409);
  const list = await fetch(`${base}/api/tickets`).then((r) => r.json());
  expect(list.items.find((t) => t.id === ticket.id).status).toBe('new');
});

// Проверка порядка заявок в ответе API, включая одинаковый приоритет
test('порядок: high -> medium -> low; внутри приоритета — новые выше', async () => {
  // создаём в неправильном порядке два high с разным временем
  const make = (priority, title) => fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title,
      description: 'Не удается подключиться к учебной сети',
      category: 'network',
      priority,
    }),
  }).then((r) => r.json());

  const l1 = await make('low', 'L1 low');
  const h1 = await make('high', 'H1 high');
  const m1 = await make('medium', 'M1 medium');
  await new Promise((r) => setTimeout(r, 5));
  const h2 = await make('high', 'H2 high');
  const l2 = await make('low', 'L2 low');


  const res = await fetch(`${base}/api/tickets`);
  const body = await res.json();

  // точный порядок id
  expect(res.status).toBe(200);
  expect(body.items.map((t) => t.id)).toEqual([
    h2.ticket.id,
    h1.ticket.id,
    m1.ticket.id,
    l2.ticket.id,
    l1.ticket.id,
  ]);
});
