import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TaskCommentsComponent } from './task-comments.component';
import { TaskComment } from './comment.models';

describe('TaskCommentsComponent', () => {
  let fixture: ComponentFixture<TaskCommentsComponent>;
  let http: HttpTestingController;
  const url = '/api/tasks/7/comments';
  const comments: TaskComment[] = [
    { id: 1, body: 'First!\nTwo lines', author: { id: 1, fullName: 'Alice Martin' }, createdAt: '2026-10-01T09:30:00', canDelete: true },
    { id: 2, body: 'Agreed', author: { id: 2, fullName: 'Bob Durand' }, createdAt: '2026-10-01T10:00:00', canDelete: false },
  ];

  const el = () => fixture.nativeElement as HTMLElement;
  const all = (sel: string) => el().querySelectorAll(sel);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskCommentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TaskCommentsComponent);
    fixture.componentInstance.taskId = 7;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const users = [
    { id: 1, fullName: 'Alice Martin', email: 'alice@test.com' },
    { id: 2, fullName: 'Bob Durand', email: 'bob@test.com' },
  ];

  function load(list: TaskComment[] = comments): void {
    http.expectOne('/api/users').flush(users);
    http.expectOne(url).flush(list);
    fixture.detectChanges();
  }

  it('lists the thread with authors and delete buttons only where allowed', () => {
    expect(el().textContent).toContain('Loading comments');
    load();
    expect(all('[data-cy=comment]').length).toBe(2);
    expect(all('[data-cy=comment-author]')[0].textContent).toContain('Alice Martin');
    expect(all('[data-cy=comment-body-text]')[0].textContent).toBe('First!\nTwo lines');
    expect(el().querySelector('[data-cy=comment-count]')?.textContent).toBe('2');
    expect(all('[data-cy=delete-comment]').length).toBe(1);
  });

  it('shows an empty state', () => {
    load([]);
    expect(el().querySelector('[data-cy=no-comments]')).not.toBeNull();
  });

  it('posts a trimmed comment and appends it', () => {
    load();
    const button = () => el().querySelector('[data-cy=comment-post]') as HTMLButtonElement;
    expect(button().disabled).toBe(true);

    fixture.componentInstance.body.setValue('  New remark  ');
    fixture.detectChanges();
    button().click();

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'New remark' });
    req.flush({ id: 3, body: 'New remark', author: { id: 1, fullName: 'Alice Martin' }, createdAt: '2026-10-02T08:00:00', canDelete: true });
    fixture.detectChanges();

    expect(all('[data-cy=comment]').length).toBe(3);
    expect(fixture.componentInstance.body.value).toBe('');
  });

  it('deletes a comment', () => {
    load();
    (el().querySelector('[data-cy=delete-comment]') as HTMLButtonElement).click();
    const req = http.expectOne(`${url}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(all('[data-cy=comment]').length).toBe(1);
  });

  it('highlights mentions of known users', () => {
    load([{ ...comments[1], body: 'Thanks @Alice Martin!' }]);
    const mentions = all('[data-cy=mention]');
    expect(mentions.length).toBe(1);
    expect(mentions[0].textContent).toBe('@Alice Martin');
    expect(all('[data-cy=comment-body-text]')[0].textContent).toBe('Thanks @Alice Martin!');
  });

  it('suggests users after "@", inserts the picked one and sends their id', () => {
    load();
    const textarea = el().querySelector('[data-cy=comment-input]') as HTMLTextAreaElement;
    const type = (value: string) => {
      textarea.value = value;
      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    type('Hey @du');
    const options = all('[data-cy=mention-option]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Bob Durand');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.body.value).toBe('Hey @Bob Durand ');
    expect(all('[data-cy=mention-option]').length).toBe(0);

    type('Hey @Bob Durand, look');
    fixture.componentInstance.post();
    const req = http.expectOne(url);
    expect(req.request.body).toEqual({ body: 'Hey @Bob Durand, look', mentionedUserIds: [2] });
    req.flush({ id: 3, body: 'Hey @Bob Durand, look', author: users[0], createdAt: '2026-10-02T08:00:00', canDelete: true });
  });

  it('does not notify a picked user whose mention was edited away', () => {
    load();
    const c = fixture.componentInstance;
    c.body.setValue('@Al');
    const textarea = el().querySelector('[data-cy=comment-input]') as HTMLTextAreaElement;
    textarea.setSelectionRange(3, 3);
    c.updateMention();
    c.pick(users[0]);
    c.body.setValue('never mind');
    c.post();
    expect(http.expectOne(url).request.body).toEqual({ body: 'never mind' });
  });

  it('shows the server error when posting fails', () => {
    load();
    fixture.componentInstance.body.setValue('Hi');
    fixture.componentInstance.post();
    http.expectOne(url).flush({ detail: 'Task 7 not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('[data-cy=comment-error]')?.textContent).toContain('Task 7 not found');
    expect(fixture.componentInstance.body.value).toBe('Hi');
  });
});
