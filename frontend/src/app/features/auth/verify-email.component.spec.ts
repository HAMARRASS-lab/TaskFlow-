import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { User } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { AuthActions } from '../../core/auth/store/auth.actions';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  const alice: User = { id: 1, email: 'a@test.com', fullName: 'Alice', role: 'USER', emailVerified: false };
  const auth = { verifyEmail: jest.fn() };

  function create(signedIn: User | null) {
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideMockStore({ selectors: [{ selector: authFeature.selectUser, value: signedIn }] }),
        { provide: AuthService, useValue: auth },
      ],
    });
    const store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();
    return { fixture, store };
  }

  it('confirms the email and refreshes the signed-in user', () => {
    const verified = { ...alice, emailVerified: true };
    auth.verifyEmail.mockReturnValue(of(verified));
    const { fixture, store } = create(alice);
    expect(auth.verifyEmail).toHaveBeenCalledWith('tok');
    expect(fixture.nativeElement.querySelector('[data-cy=verify-done]')).not.toBeNull();
    expect(store.dispatch).toHaveBeenCalledWith(AuthActions.userUpdated({ user: verified }));
  });

  it("leaves another account's session alone", () => {
    auth.verifyEmail.mockReturnValue(of({ ...alice, id: 99, emailVerified: true }));
    const { store } = create(alice);
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
