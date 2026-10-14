import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  const auth = { resetPassword: jest.fn() };

  function create(token?: string) {
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideNoopAnimations(), provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    if (token) fixture.componentRef.setInput('token', token);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => auth.resetPassword.mockReset());

  it('rejects mismatched passwords', () => {
    const component = create('tok').componentInstance;
    component.form.setValue({ password: 'password123', confirm: 'password124' });
    expect(component.form.hasError('mismatch')).toBe(true);
    component.submit();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the token and new password', () => {
    auth.resetPassword.mockReturnValue(of(undefined));
    const fixture = create('tok');
    fixture.componentInstance.form.setValue({ password: 'password123', confirm: 'password123' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.resetPassword).toHaveBeenCalledWith('tok', 'password123');
    expect(fixture.nativeElement.querySelector('[data-cy=reset-done]')).not.toBeNull();
  });

  it('shows the server error for an expired link', () => {
    auth.resetPassword.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 400, error: { detail: 'This link is invalid or has expired' } })));
    const fixture = create('tok');
    fixture.componentInstance.form.setValue({ password: 'password123', confirm: 'password123' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-cy=error]').textContent).toContain('invalid or has expired');
  });

  it('explains a link without token', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[data-cy=error]').textContent).toContain('incomplete');
  });
});
