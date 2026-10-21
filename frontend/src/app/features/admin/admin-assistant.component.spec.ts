import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { AdminAssistantComponent } from './admin-assistant.component';
import { AdminService } from './admin.service';

describe('AdminAssistantComponent', () => {
  const chat = jest.fn();

  beforeEach(() => {
    chat.mockReset();
    TestBed.configureTestingModule({
      imports: [AdminAssistantComponent, NoopAnimationsModule],
      providers: [{ provide: AdminService, useValue: { chat } }],
    });
  });

  it('shows the question and the bot reply', () => {
    chat.mockReturnValue(of({ reply: 'There are 4 tasks to do.' }));
    const component = TestBed.createComponent(AdminAssistantComponent).componentInstance;

    component.ask('  How many tasks are to do?  ');

    expect(chat).toHaveBeenCalledWith('How many tasks are to do?');
    expect(component.messages()).toEqual([
      { from: 'user', text: 'How many tasks are to do?' },
      { from: 'bot', text: 'There are 4 tasks to do.' },
    ]);
    expect(component.sending()).toBe(false);
  });

  it('shows server errors as bot messages and ignores blank input', () => {
    chat.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503, error: { detail: 'The assistant is not configured (set OPENAI_API_KEY)' },
    })));
    const component = TestBed.createComponent(AdminAssistantComponent).componentInstance;

    component.ask('   ');
    expect(chat).not.toHaveBeenCalled();

    component.ask('Tasks per status');
    expect(component.messages()[1]).toEqual({
      from: 'bot', text: 'The assistant is not configured (set OPENAI_API_KEY)', error: true,
    });
  });
});
