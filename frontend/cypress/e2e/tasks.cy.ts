describe('Task board', () => {
  beforeEach(() => {
    cy.loginAsFakeUser();
    cy.intercept('GET', '/api/tasks', { fixture: 'tasks.json' }).as('tasks');
    cy.visit('/tasks');
    cy.wait('@tasks');
  });

  it('lists tasks and statistics', () => {
    cy.get('[data-cy=task-card]').should('have.length', 3);
    cy.get('[data-cy=stat-done]').should('contain', '1');
  });

  it('filters by status', () => {
    cy.get('[data-cy=filter-TODO]').click();
    cy.get('[data-cy=task-card]').should('have.length', 1).and('contain', 'Write Cypress tests');
  });

  it('creates a task', () => {
    cy.intercept('POST', '/api/tasks', (req) => {
      req.reply({
        statusCode: 201,
        body: { id: 4, status: 'TODO', description: null, dueDate: null, createdAt: '2026-10-03T10:00:00',
                updatedAt: '2026-10-03T10:00:00', ...req.body },
      });
    }).as('create');

    cy.get('[data-cy=new-task]').click();
    cy.get('[data-cy=task-title]').type('Deploy to the cloud');
    cy.get('[data-cy=task-save]').click();

    cy.wait('@create');
    cy.get('[data-cy=task-card]').should('have.length', 4).first().should('contain', 'Deploy to the cloud');
  });

  it('deletes a task', () => {
    cy.intercept('DELETE', '/api/tasks/3', { statusCode: 204 }).as('delete');
    cy.get('[data-cy=task-card]').contains('Write Cypress tests')
      .parents('[data-cy=task-card]').find('[data-cy=delete-task]').click();
    cy.wait('@delete');
    cy.get('[data-cy=task-card]').should('have.length', 2);
  });
});
