describe('Time reports', () => {
  const report = {
    from: '2026-08-01', to: '2026-10-29', userId: null, totalSeconds: 151_200, entryCount: 38,
    byUser: [
      { id: 1, fullName: 'Alice', seconds: 93_600 },
      { id: 2, fullName: 'Bob Durand', seconds: 57_600 },
    ],
    byLabel: [
      { label: 'backend', seconds: 72_000 },
      { label: 'frontend', seconds: 50_400 },
      { label: 'docs', seconds: 14_400 },
      { label: null, seconds: 21_600 },
    ],
    byWeek: [0, 3, 5.5, 2, 4, 6, 0, 3.5, 7, 5, 2.5, 1, 2].map((h, i) => ({
      weekStart: new Date(Date.UTC(2026, 6, 27 + i * 7)).toISOString().slice(0, 10), seconds: h * 3600,
    })),
    topTasks: [
      { id: 1, title: 'Implement JWT auth', estimateMinutes: 900, seconds: 64_800 },
      { id: 2, title: 'Kanban drag-and-drop', estimateMinutes: 1200, seconds: 43_200 },
      { id: 3, title: 'Write Cypress tests', estimateMinutes: null, seconds: 21_600 },
    ],
  };

  beforeEach(() => {
    cy.loginAsFakeUser();
    cy.intercept('GET', '/api/notifications*', []);
    cy.intercept('GET', '/api/time/report?*', report).as('report');
    cy.visit('/reports');
    cy.wait('@report');
  });

  it('shows the totals and charts, and reloads for another person', () => {
    cy.get('[data-cy=report-user]').should('contain', 'Everyone');
    cy.get('[data-cy=total]').should('have.text', '42h');
    cy.get('[data-cy=week-col]').should('have.length', 13);
    cy.get('[data-cy=by-user]').should('contain', 'Bob Durand').and('contain', '16h');
    cy.get('[data-cy=top-tasks]').should('contain', '3h over');
    cy.screenshot('time-report', { capture: 'fullPage' });

    cy.get('[data-cy=report-user]').click();
    cy.get('mat-option').contains('Bob Durand').click();
    cy.wait('@report').its('request.url').should('contain', 'userId=2');
  });

  it('downloads the CSV for the period on screen', () => {
    cy.intercept('GET', '/api/time/report/csv?*', { body: 'Date\r\n', headers: { 'content-type': 'text/csv' } }).as('csv');
    cy.get('[data-cy=export-csv]').click();
    cy.wait('@csv').its('request.url').should('match', /from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  });
});
