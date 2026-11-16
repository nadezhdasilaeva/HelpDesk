import { TicketsPage } from '../pages/TicketsPage';

const page = new TicketsPage();

describe('HelpDesk — базовые E2E-проверки', () => {
  beforeEach(() => {
    // Сброс доступен только при запуске npm run start:test.
    cy.request('POST', '/api/__reset');
  });

  it('показывает исходные заявки', () => {
    page.open();
    cy.get('[data-testid="page-title"]').should('contain', 'HelpDesk');
    page.items().should('have.length', 4);
    page.count().should('have.text', '4');
  });

  // Создание заявки через форму с проверкой сообщения и появления записи в списке
  it('Создание заявки через форму с проверкой сообщения и появления записи в списке', () => {
    cy.intercept('POST', '/api/tickets').as('createTicket');

    form.fill({
      title: 'Компьютер не работает',
      description: 'Не включается',
      category: 'hardware',
      priority: 'medium',
    });
    form.submit();

    cy.wait('@createTicket').its('response.statusCode').should('eq', 201);
    form.message().should('be.visible').and('contain.text', 'создана');
    page.items().should('have.length', 5);
  });
});

// Поиск и комбинированная фильтрация с проверкой количества и содержимого результата
it('Перевод заявки в работу и завершение через интерфейс; проверка конечного статуса (resolved)', () => {
  const title = 'Компьютер не работает';


  cy.request('POST', '/api/tickets', {
    title,
    description: 'Компьютер в аудитории не включается',
    category: 'hardware',
    priority: 'high',
  }).then(({ body }) => {
    const id = body.ticket.id;


    cy.request('GET', '/api/tickets').then((res) => {
      const found = res.body.items.find((t) => t.id === id);
      expect(found, `заявка id=${id} должна быть в хранилище`).to.exist;
      expect(found.status).to.equal('new');
    });


    cy.intercept('GET', '/api/tickets*').as('list');
    page.open();
    cy.wait('@list');


    const item = () => cy.get(`[data-testid="ticket-item"][data-id="${id}"]`);
    item().should('exist');


    item().find('.ticket-meta span').last().should('have.text', 'Новая');


    cy.intercept('PATCH', `/api/tickets/${id}/status`).as('toInProgress');
    item().find('button[data-next="in_progress"]').click();
    cy.wait('@toInProgress').its('response.statusCode').should('eq', 200);


    item().find('.ticket-meta span').last().should('have.text', 'В работе');


    cy.request('GET', '/api/tickets').then((r) => {
      expect(r.body.items.find((t) => t.id === id).status).to.equal('in_progress');
    });


    cy.intercept('PATCH', `/api/tickets/${id}/status`).as('toResolved');
    item().find('button[data-next="resolved"]').click();
    cy.wait('@toResolved').its('response.statusCode').should('eq', 200);


    item().find('.ticket-meta span').last().should('have.text', 'Завершена');


    cy.request('GET', '/api/tickets').then((r) => {
      expect(r.body.items.find((t) => t.id === id).status).to.equal('resolved');
    });
  });
});
// Дополнительный сценарий: пользовательский текст с символами разметки должен остаться текстом

it('пользовательский текст с символами разметки должен остаться текстом', () => {
  const title = '<b>Сбой</b> принтера';
  const description = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned=true">';


  cy.request('POST', '/api/tickets', {
    title,
    description,
    category: 'hardware',
    priority: 'high',
  }).then(({ body }) => {
    const id = body.ticket.id;


    cy.intercept('GET', '/api/tickets*').as('list');
    page.open();
    cy.wait('@list');

    const item = () => cy.get(`[data-testid="ticket-item"][data-id="${id}"]`);
    item().should('exist');


    item().find('b').should('not.exist');
    item().find('script').should('not.exist');
    item().find('img').should('not.exist');

   
    item().find('.ticket-title').should('have.text', '<b>Сбой</b> принтера');
    item().find('.ticket-description').should('contain.text', '<script>');
    item().find('.ticket-description').should('contain.text', '<img');


    cy.window().its('__pwned').should('be.undefined');
  });
});
