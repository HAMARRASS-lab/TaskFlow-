// Logs a fake user in by seeding localStorage, so specs can start on protected pages.
Cypress.Commands.add('loginAsFakeUser', () => {
  const user = { id: 1, email: 'alice@test.com', fullName: 'Alice', role: 'USER' };
  // The app refreshes the user and polls invitations on startup; a 401 there would log the fake user out.
  cy.intercept('GET', '/api/auth/me', user);
  cy.intercept('GET', '/api/meetings/invitations', []);
  window.localStorage.setItem(
    'taskflow.auth',
    JSON.stringify({
      token: 'fake.jwt.token',
      expiresAt: Date.now() + 3_600_000,
      user,
    }),
  );
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginAsFakeUser(): Chainable<void>;
    }
  }
}

export {};
