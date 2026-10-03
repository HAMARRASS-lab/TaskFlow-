// Logs a fake user in by seeding localStorage, so specs can start on protected pages.
Cypress.Commands.add('loginAsFakeUser', () => {
  window.localStorage.setItem(
    'taskflow.auth',
    JSON.stringify({
      token: 'fake.jwt.token',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 1, email: 'alice@test.com', fullName: 'Alice', role: 'USER' },
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
