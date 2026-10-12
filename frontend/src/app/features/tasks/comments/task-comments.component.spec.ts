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

  function load(list: TaskComment[] = comments): void {
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
