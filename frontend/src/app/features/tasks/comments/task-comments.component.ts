import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { errorMessage } from '../../../core/api';
import { TaskComment } from './comment.models';
import { CommentService } from './comment.service';

/** Comment thread of a task, oldest first, with a box to add one. Used in the task dialogs. */
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
        @for (c of comments(); track c.id) {
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
              <p class="body" data-cy="comment-body-text">{{ c.body }}</p>
            </div>
          </article>
        } @empty {
          <p class="muted" data-cy="no-comments">No comments yet. Start the discussion.</p>
        }
      }

      <div class="compose">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Add a comment</mat-label>
          <textarea matInput [formControl]="body" rows="2" maxlength="2000" data-cy="comment-input"
                    (keydown.control.enter)="post()" (keydown.meta.enter)="post()"></textarea>
        </mat-form-field>
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
    .compose { display: flex; align-items: flex-start; gap: 8px; }
    .compose mat-form-field { flex: 1; }
    .compose button { margin-top: 8px; }
    .error-text { margin: 6px 0 0; color: var(--tf-high); font-size: 13px; }
  `],
})
export class TaskCommentsComponent implements OnInit {
  @Input({ required: true }) taskId!: number;

  private readonly service = inject(CommentService);

  readonly comments = signal<TaskComment[]>([]);
  readonly loading = signal(true);
  readonly posting = signal(false);
  readonly error = signal<string | null>(null);
  readonly body = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] });

  ngOnInit(): void {
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
    this.service.create(this.taskId, text).subscribe({
      next: (comment) => {
        this.comments.update((list) => [...list, comment]);
        this.body.reset();
        this.posting.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.posting.set(false);
      },
    });
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
