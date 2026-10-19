import { Component, ElementRef, Input, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../../core/api';
import { UserDirectoryService } from '../../../core/user-directory.service';
import { UserSummary } from '../task.models';
import { TaskComment } from './comment.models';
import { CommentService } from './comment.service';
import { MentionQuery, matchUsers, mentionQuery, splitMentions } from './mentions';

/**
 * Comment thread of a task, oldest first, with a box to add one. Used in the task dialogs. Typing "@" suggests
 * users; the picked ones are notified that they were mentioned, and mentions are highlighted in the thread.
 */
@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="comments" data-cy="comments">
      <h3>Comments @if (!loading()) { <span class="count" data-cy="comment-count">{{ comments().length }}</span> }</h3>

      @if (loading()) {
        <p class="muted">Loading comments…</p>
      } @else {
        @for (c of thread(); track c.id) {
          <article class="comment" data-cy="comment">
            <span class="avatar" aria-hidden="true">{{ initials(c.author.fullName) }}</span>
            <div class="content">
              <div class="meta">
                <strong data-cy="comment-author">{{ c.author.fullName }}</strong>
                <time [attr.datetime]="c.createdAt">{{ c.createdAt | date: 'MMM d, y, HH:mm' }}</time>
                @if (c.canDelete) {
                  <button mat-icon-button type="button" class="delete" (click)="remove(c)"
                          aria-label="Delete comment" data-cy="delete-comment">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                }
              </div>
              <p class="body" data-cy="comment-body-text">@for (part of c.parts; track $index) {@if (part.mention) {<span class="mention" data-cy="mention">{{ part.text }}</span>} @else {<span>{{ part.text }}</span>}}</p>
            </div>
          </article>
        } @empty {
          <p class="muted" data-cy="no-comments">No comments yet. Start the discussion.</p>
        }
      }

      <div class="compose">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Add a comment</mat-label>
          <textarea #input matInput [formControl]="body" rows="2" maxlength="2000" data-cy="comment-input"
                    placeholder="Type @ to mention someone"
                    (input)="updateMention()" (click)="updateMention()" (keydown)="onKeydown($event)"
                    (blur)="closeMention()"
                    (keydown.control.enter)="post()" (keydown.meta.enter)="post()"></textarea>
        </mat-form-field>
        @if (suggestions().length) {
          <ul class="suggestions" role="listbox" aria-label="Mention someone" data-cy="mention-suggestions">
            @for (u of suggestions(); track u.id; let i = $index) {
              <li role="option" [class.active]="i === active()" [attr.aria-selected]="i === active()"
                  (mousedown)="$event.preventDefault(); pick(u)" data-cy="mention-option">
                <span class="avatar small" aria-hidden="true">{{ initials(u.fullName) }}</span>
                <span class="name">{{ u.fullName }}</span>
                <span class="email">{{ u.email }}</span>
              </li>
            }
          </ul>
        }
        <button mat-flat-button color="primary" type="button" (click)="post()"
                [disabled]="!body.value.trim() || posting()" data-cy="comment-post">Comment</button>
      </div>
      @if (error()) { <p class="error-text" data-cy="comment-error">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    .comments { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--tf-border); }
    h3 {
      display: flex; align-items: center; gap: 6px; margin: 0 0 12px; line-height: 20px; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted);
    }
    .count {
      padding: 2px 8px; border-radius: 99px; line-height: 14px; letter-spacing: 0;
      background: var(--tf-accent-soft); color: var(--tf-accent);
    }
    .muted { margin: 0 0 12px; color: var(--tf-muted); font-size: 14px; }
    .comment { display: flex; gap: 10px; margin-bottom: 14px; }
    .avatar {
      flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
      background: var(--tf-accent-soft); color: var(--tf-accent); font-size: 11px; font-weight: 700;
    }
    .content { flex: 1; min-width: 0; }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 13px; min-height: 24px; }
    .meta strong { color: var(--tf-text); font-weight: 600; }
    .meta time { color: var(--tf-muted); font-size: 12px; }
    .delete { margin-left: auto; width: 32px; height: 32px; padding: 4px; color: var(--tf-muted); }
    .delete mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .delete:hover { color: var(--tf-high); }
    .body { margin: 2px 0 0; white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-size: 14px; color: var(--tf-text); }
    .mention { padding: 0 2px; border-radius: 4px; background: var(--tf-accent-soft); color: var(--tf-accent); font-weight: 500; }
    .compose { position: relative; display: flex; align-items: flex-start; gap: 8px; }
    .suggestions {
      position: absolute; z-index: 10; left: 0; bottom: 100%; margin: 0 0 4px; padding: 4px; list-style: none;
      min-width: 240px; max-width: 100%; border: 1px solid var(--tf-border); border-radius: 10px;
      background: var(--tf-surface); box-shadow: var(--tf-shadow-hover);
    }
    .suggestions li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .suggestions li.active, .suggestions li:hover { background: var(--tf-accent-soft); }
    .suggestions .name { color: var(--tf-text); font-weight: 500; white-space: nowrap; }
    .suggestions .email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tf-muted); font-size: 12px; }
    .avatar.small { width: 24px; height: 24px; font-size: 10px; }
    .compose mat-form-field { flex: 1; }
    .compose button { margin-top: 8px; }
    .error-text { margin: 6px 0 0; color: var(--tf-high); font-size: 13px; }
  `],
})
export class TaskCommentsComponent implements OnInit {
  @Input({ required: true }) taskId!: number;

  @ViewChild('input', { static: true }) private input!: ElementRef<HTMLTextAreaElement>;

  private readonly service = inject(CommentService);
  private readonly directory = inject(UserDirectoryService);

  readonly comments = signal<TaskComment[]>([]);
  readonly users = signal<UserSummary[]>([]);
  /** The comments split into text and highlighted "@Full Name" mentions. */
  readonly thread = computed(() => {
    const names = this.users().map((u) => u.fullName);
    return this.comments().map((c) => ({ ...c, parts: splitMentions(c.body, names) }));
  });
  /** The "@…" being typed, and the users it matches. */
  private readonly mention = signal<MentionQuery | null>(null);
  readonly suggestions = computed(() => {
    const m = this.mention();
    return m ? matchUsers(this.users(), m.query) : [];
  });
  readonly active = signal(0);
  /** Users picked in the suggestions since the last post. */
  private readonly picked = new Map<number, UserSummary>();
  readonly loading = signal(true);
  readonly posting = signal(false);
  readonly error = signal<string | null>(null);
  readonly body = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] });

  ngOnInit(): void {
    // without the directory, comments still work: no suggestions and no highlighting
    this.directory.users().subscribe({ next: (users) => this.users.set(users), error: () => undefined });
    this.service.getAll(this.taskId).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  post(): void {
    const text = this.body.value.trim();
    if (!text || this.posting()) return;
    this.posting.set(true);
    this.error.set(null);
    // only the picked users whose "@Full Name" survived the editing
    const lower = text.toLowerCase();
    const mentioned = [...this.picked.values()]
      .filter((u) => lower.includes(`@${u.fullName.toLowerCase()}`))
      .map((u) => u.id);
    this.service.create(this.taskId, text, mentioned).subscribe({
      next: (comment) => {
        this.comments.update((list) => [...list, comment]);
        this.body.reset();
        this.picked.clear();
        this.closeMention();
        this.posting.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.posting.set(false);
      },
    });
  }

  updateMention(): void {
    const el = this.input.nativeElement;
    const m = el.selectionStart === el.selectionEnd ? mentionQuery(el.value, el.selectionStart) : null;
    this.mention.set(m);
    this.active.set(0);
  }

  closeMention(): void {
    this.mention.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();
    if (!list.length || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'ArrowDown':
        this.active.set((this.active() + 1) % list.length);
        break;
      case 'ArrowUp':
        this.active.set((this.active() - 1 + list.length) % list.length);
        break;
      case 'Enter':
      case 'Tab':
        this.pick(list[this.active()]);
        break;
      case 'Escape':
        this.closeMention();
        event.stopPropagation(); // keep the dialog open
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Replaces the "@…" being typed with "@Full Name ". */
  pick(user: UserSummary): void {
    const m = this.mention();
    if (!m) return;
    const el = this.input.nativeElement;
    const value = this.body.value;
    const insert = `@${user.fullName} `;
    this.body.setValue(value.slice(0, m.start) + insert + value.slice(el.selectionStart));
    const caret = m.start + insert.length;
    el.setSelectionRange(caret, caret);
    this.picked.set(user.id, user);
    this.closeMention();
  }

  remove(comment: TaskComment): void {
    this.error.set(null);
    this.service.delete(this.taskId, comment.id).subscribe({
      next: () => this.comments.update((list) => list.filter((c) => c.id !== comment.id)),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }
}
