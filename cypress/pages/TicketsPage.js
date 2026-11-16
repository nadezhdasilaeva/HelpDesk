export class TicketsPage {
  open() { cy.visit('/'); }
  items() { return cy.get('[data-testid="ticket-item"]'); }
  count() { return cy.get('[data-testid="ticket-count"]'); }
  searchFor(text) { cy.get('[data-testid="search"]').clear().type(text); }
  setStatus(status) { cy.get('[data-testid="status-filter"]').select(status); }
  setCategory(category) { cy.get('[data-testid="category-filter"]').select(category); }
itemByTitle(title) {
    return this.items()
      .contains('[data-testid="ticket-title"]', title)
      .closest('[data-testid="ticket-item"]');
  }

  statusOf(title) {
    return this.itemByTitle(title).find('[data-testid="ticket-status"]');
  }

  startTicket(title) {
    this.itemByTitle(title).find('[data-testid="ticket-start"]').click();
  }

  resolveTicket(title) {
    this.itemByTitle(title).find('[data-testid="ticket-resolve"]').click();
  }
}
