describe('Authentication', () => {
  it('redirects anonymous users to the login page', () => {
    cy.visit('/tasks');
    cy.url().should('include', '/login');
  });

  it('logs in and lands on the task board', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: 'fake.jwt.token',
        expiresIn: 3_600_000,
        user: { id: 1, email: 'alice@test.com', fullName: 'Alice', role: 'USER' },
      },
    }).as('login');
    cy.intercept('GET', '/api/tasks', { fixture: 'tasks.json' }).as('tasks');
    cy.intercept('GET', '/api/auth/me', { id: 1, email: 'alice@test.com', fullName: 'Alice', role: 'USER' });
    cy.intercept('GET', '/api/meetings/invitations', []);

    cy.visit('/login');
    cy.get('[data-cy=email]').type('alice@test.com');
    cy.get('[data-cy=password]').type('password123');
    cy.get('[data-cy=submit]').click();

    cy.wait('@login');
    cy.wait('@tasks');
    cy.url().should('include', '/tasks');
    cy.contains('Alice');
  });

  it('shows an error on bad credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { detail: 'Invalid email or password' },
    });

    cy.visit('/login');
    cy.get('[data-cy=email]').type('alice@test.com');
    cy.get('[data-cy=password]').type('wrongpass');
    cy.get('[data-cy=submit]').click();

    cy.get('[data-cy=error]').should('contain', 'Invalid email or password');
  });
});
