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

  it('shows a kanban column per status', () => {
    cy.get('[data-cy=column-TODO] [data-cy=task-card]').should('have.length', 1).and('contain', 'Write Cypress tests');
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=task-card]').should('have.length', 1);
    cy.get('[data-cy=column-DONE] [data-cy=column-count]').should('have.text', '1');
  });

  it('moves a task to another column by dragging it', () => {
    cy.intercept('PATCH', '/api/tasks/3/status', (req) => {
      req.reply({ statusCode: 200, body: { id: 3, title: 'Write Cypress tests', description: 'E2E coverage',
        priority: 'LOW', dueDate: null, labels: ['frontend'], checklist: [], createdAt: '2026-09-22T10:00:00',
        updatedAt: '2026-10-03T10:00:00', ...req.body } });
    }).as('status');

    cy.get('[data-cy=column-TODO] [data-cy=task-card]').first().scrollIntoView();
    cy.window().then((win) => {
      const card = win.document.querySelector('[data-cy=column-TODO] [data-cy=task-card] .title')!;
      const target = win.document.querySelector('[data-cy=column-IN_PROGRESS] .drop')!.getBoundingClientRect();
      // Native events: CDK ignores mousedowns with `buttons` or `detail` 0 (what screen readers send)
      const fire = (on: EventTarget, type: string, x: number, y: number) =>
        on.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win, button: 0, detail: 1,
          buttons: type === 'mouseup' ? 0 : 1, clientX: x, clientY: y }));
      const start = card.getBoundingClientRect();
      const x = target.x + target.width / 2, y = target.y + 30;
      fire(card, 'mousedown', start.x + 5, start.y + 5);
      fire(win.document, 'mousemove', start.x + 25, start.y + 5);
      fire(win.document, 'mousemove', x, y);
      fire(win.document, 'mousemove', x, y + 5);
      fire(win.document, 'mouseup', x, y + 5);
    });

    cy.wait('@status').its('request.body').should('deep.equal', { status: 'IN_PROGRESS' });
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=task-card]').should('have.length', 2).and('contain', 'Write Cypress tests');
    cy.get('[data-cy=column-TODO] [data-cy=task-card]').should('not.exist');
  });

  it('puts the task back if the server refuses the move', () => {
    cy.intercept('PATCH', '/api/tasks/2/status', { statusCode: 500, body: { detail: 'Server down' } }).as('status');
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=status-select]').click();
    cy.get('mat-option').contains('Done').click();
    cy.wait('@status');
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=task-card]').should('contain', 'Implement JWT auth');
    cy.contains('Server down');
  });

  it('filters by label', () => {
    cy.get('[data-cy=task-card]').first().find('[data-cy=label-chip]').should('exist');
    cy.get('[data-cy=label-filter]').click();
    cy.get('mat-option').contains('backend').click();
    cy.get('[data-cy=task-card]').should('have.length', 2);
    cy.get('[data-cy=column-TODO]').should('contain', 'No matching tasks');
  });

  it('shows checklist progress and ticks an item', () => {
    cy.intercept('PATCH', '/api/tasks/2/checklist/22', { statusCode: 200, body: { id: 2, title: 'Implement JWT auth',
      description: null, status: 'IN_PROGRESS', priority: 'HIGH', dueDate: null, labels: ['backend', 'security'],
      checklist: [{ id: 21, title: 'Login endpoint', done: true }, { id: 22, title: 'Token refresh', done: true }],
      createdAt: '2026-09-21T10:00:00', updatedAt: '2026-10-03T10:00:00' } }).as('toggle');

    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=checklist-progress]').should('contain', '1/2 done').click();
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=checklist-item]').contains('Token refresh').click();
    cy.wait('@toggle').its('request.body').should('deep.equal', { done: true });
    cy.get('[data-cy=column-IN_PROGRESS] [data-cy=checklist-progress]').should('contain', '2/2 done');
  });

  it('filters by status in list view', () => {
    cy.get('[data-cy=view-LIST]').click();
    cy.get('[data-cy=filter-TODO]').click();
    cy.get('[data-cy=task-card]').should('have.length', 1).and('contain', 'Write Cypress tests');
  });

  it('searches, filters by priority and sorts', () => {
    cy.get('[data-cy=view-LIST]').click();
    cy.get('[data-cy=task-search]').type('jwt');
    cy.get('[data-cy=task-card]').should('have.length', 1).and('contain', 'Implement JWT auth');

    cy.get('[data-cy=clear-filters]').click();
    cy.get('[data-cy=priority-filter]').click();
    cy.get('mat-option').contains('LOW').click();
    cy.get('[data-cy=task-card]').should('have.length', 1).and('contain', 'Write Cypress tests');

    cy.get('[data-cy=task-search]').type('nothing matches');
    cy.get('[data-cy=no-match]').should('be.visible').find('button').click();
    cy.get('[data-cy=task-card]').should('have.length', 3);

    cy.get('[data-cy=task-sort]').click();
    cy.get('mat-option').contains('Title').click();
    cy.get('[data-cy=task-card]').first().should('contain', 'Design database schema');
  });

  it('creates a task', () => {
    cy.intercept('POST', '/api/tasks', (req) => {
      req.reply({
        statusCode: 201,
        body: { id: 4, status: 'TODO', description: null, dueDate: null, createdAt: '2026-10-03T10:00:00',
                updatedAt: '2026-10-03T10:00:00', ...req.body,
                checklist: req.body.checklist.map((i: object, n: number) => ({ ...i, id: 40 + n })) },
      });
    }).as('create');

    cy.get('[data-cy=new-task]').click();
    cy.get('[data-cy=task-title]').type('Deploy to the cloud');
    cy.get('[data-cy=label-input]').type('DevOps{enter}');
    cy.get('[data-cy=label-input]').type('back');
    cy.get('mat-option').contains('backend').click();
    cy.get('[data-cy=checklist-new]').type('Build image{enter}');
    cy.get('[data-cy=checklist-new]').type('Push to registry{enter}');
    cy.get('[data-cy=checklist-row]').should('have.length', 2);
    cy.get('[data-cy=task-save]').click();

    cy.wait('@create').its('request.body').should('deep.include', {
      labels: ['devops', 'backend'],
      checklist: [{ id: null, title: 'Build image', done: false }, { id: null, title: 'Push to registry', done: false }],
    });
    cy.get('[data-cy=task-card]').should('have.length', 4).first().should('contain', 'Deploy to the cloud')
      .and('contain', '0/2 done').and('contain', 'devops');
  });

  it('deletes a task', () => {
    cy.intercept('DELETE', '/api/tasks/3', { statusCode: 204 }).as('delete');
    cy.get('[data-cy=task-card]').contains('Write Cypress tests')
      .parents('[data-cy=task-card]').find('[data-cy=delete-task]').click();
    cy.wait('@delete');
    cy.get('[data-cy=task-card]').should('have.length', 2);
  });
});
