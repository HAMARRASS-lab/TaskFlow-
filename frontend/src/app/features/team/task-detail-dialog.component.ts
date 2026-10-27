import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { errorMessage } from '../../core/api';
import { authFeature } from '../../core/auth/store/auth.reducer';
import { TaskActivityComponent } from '../tasks/activity/task-activity.component';
import { TaskCommentsComponent } from '../tasks/comments/task-comments.component';
import { TaskTimeComponent } from '../tasks/time/task-time.component';
import { LabelChipComponent } from '../tasks/components/label-chip.component';
import { AdminService } from '../admin/admin.service';
import { UserAvatarComponent } from '../tasks/components/user-avatar.component';
import { TaskService } from '../tasks/task.service';
import { STATUS_LABELS, Task, UserSummary, checklistProgress, isOverdue, isWatching } from '../tasks/task.models';

export interface TaskDetailData {
  task: Task;
  ownerName: string;
  /**
   * Admins only: every user. The admin can assign the task to any of them (applied at once, see `taskChange`) or
   * transfer its ownership (the dialog then closes with the chosen user id).
   */
  users?: UserSummary[];
  ownerId?: number;
}

/** View of a teammate's task, opened from the Team page: anyone can watch it, admins can assign or transfer it. */
@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [DatePipe, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, TaskTimeComponent, TaskCommentsComponent, TaskActivityComponent, LabelChipComponent, UserAvatarComponent],
  template: `
    <h2 mat-dialog-title data-cy="detail-title">{{ task().title }}</h2>
    <mat-dialog-content>
      <div class="chips">
        <span class="chip priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        <span class="chip status" [attr.data-status]="task().status" data-cy="detail-status">{{ labels[task().status] }}</span>
        @if (overdue) { <span class="chip overdue"><mat-icon>error_outline</mat-icon>Overdue</span> }
        @for (l of task().labels; track l) { <app-label-chip [label]="l" /> }
      </div>

      <h3>Description</h3>
      @if (task().description) {
        <p class="desc" data-cy="detail-description">{{ task().description }}</p>
      } @else {
        <p class="desc muted">No description.</p>
      }

      @if (task().checklist.length) {
        <h3>Checklist · {{ progress.done }}/{{ progress.total }}</h3>
        <ul class="checklist" data-cy="detail-checklist">
          @for (item of task().checklist; track item.id) {
            <li [class.done]="item.done">
              <mat-icon>{{ item.done ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>{{ item.title }}
            </li>
          }
        </ul>
      }

      <dl>
        <dt>Owner</dt><dd data-cy="detail-owner">{{ data.ownerName }}</dd>
        <dt>Assignee</dt><dd data-cy="detail-assigned-to">{{ task().assignee?.fullName ?? 'Unassigned' }}</dd>
        <dt>Watchers</dt><dd data-cy="detail-watchers">{{ watcherNames() || 'None' }}</dd>
        <dt>Due date</dt>
        <dd [class.overdue]="overdue">{{ task().dueDate ? (task().dueDate | date: 'EEEE, MMM d, y') : 'None' }}</dd>
        <dt>Created</dt><dd>{{ task().createdAt | date: 'MMM d, y, HH:mm' }}</dd>
        <dt>Last updated</dt><dd>{{ task().updatedAt | date: 'MMM d, y, HH:mm' }}</dd>
      </dl>

      @if (data.users; as users) {
        <section class="admin" data-cy="detail-admin">
          <h3><mat-icon>admin_panel_settings</mat-icon> Admin</h3>
          <mat-form-field appearance="outline" class="assign" subscriptSizing="dynamic">
            <mat-label>Assign to</mat-label>
            <mat-select [value]="task().assignee?.id ?? null" (selectionChange)="assign($event.value)"
                        [disabled]="busy()" data-cy="detail-assign">
              <mat-select-trigger>{{ task().assignee?.fullName ?? 'Unassigned' }}</mat-select-trigger>
              <mat-option [value]="null"><span class="muted">Unassigned</span></mat-option>
              @for (u of users; track u.id) {
                <mat-option [value]="u.id">
                  <span class="person">
                    <app-user-avatar [user]="u" [size]="24" [tooltip]="null" />
                    <span class="who"><span>{{ u.fullName }}</span><span class="email">{{ u.email }}</span></span>
                  </span>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="assign" subscriptSizing="dynamic">
            <mat-label>Transfer ownership to</mat-label>
            <mat-select [(ngModel)]="transferTo" data-cy="detail-transfer-to">
              @for (u of users; track u.id) { <mat-option [value]="u.id">{{ u.fullName }} · {{ u.email }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </section>
      }

      <app-task-time [taskId]="task().id" />
      <app-task-comments [taskId]="task().id" />
      <app-task-activity [taskId]="task().id" [version]="task().updatedAt" />

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="toggleWatch()" [disabled]="busy()" data-cy="detail-watch">
        <mat-icon>{{ watching() ? 'visibility_off' : 'visibility' }}</mat-icon>
        {{ watching() ? 'Stop watching' : 'Watch' }}
      </button>
      <span class="spacer"></span>
      <button mat-button mat-dialog-close data-cy="detail-close">Close</button>
      @if (data.users) {
        <button mat-flat-button color="primary" [disabled]="!transferTo || transferTo === data.ownerId"
                (click)="transfer()" data-cy="detail-transfer">Transfer</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px;
      font-size: 12px; font-weight: 600;
    }
    .chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .priority[data-priority='HIGH'] { color: var(--tf-high); background: #fee2e2; }
    .priority[data-priority='MEDIUM'] { color: #b45309; background: #fef3c7; }
    .priority[data-priority='LOW'] { color: #047857; background: #d1fae5; }
    .status[data-status='TODO'] { background: #f1f5f9; color: #475569; }
    .status[data-status='IN_PROGRESS'] { background: #fef3c7; color: #b45309; }
    .status[data-status='DONE'] { background: #d1fae5; color: #047857; }
    .chip.overdue { color: var(--tf-high); background: #fee2e2; }

    h3 { margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--tf-muted); }
    .desc { margin: 0 0 20px; white-space: pre-wrap; word-break: break-word; line-height: 1.55; color: var(--tf-text); }
    .desc.muted { color: var(--tf-muted); }

    .checklist { list-style: none; margin: 0 0 20px; padding: 0; font-size: 14px; }
    .checklist li { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    .checklist mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--tf-muted); flex: none; }
    .checklist li.done { color: var(--tf-muted); text-decoration: line-through; }
    .checklist li.done mat-icon { color: var(--tf-done); }

    dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; font-size: 14px; }
    dt { color: var(--tf-muted); }
    dd { margin: 0; color: var(--tf-text); }
    dd.overdue { color: var(--tf-high); font-weight: 500; }
    .admin { margin: 20px 0 8px; padding-top: 16px; border-top: 1px solid var(--tf-border); }
    .admin h3 { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .admin h3 mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .assign { width: 100%; margin-bottom: 12px; }
    .person { display: inline-flex; align-items: center; gap: 10px; }
    .who { display: flex; flex-direction: column; line-height: 1.25; }
    .email, .muted { font-size: 12px; color: var(--tf-muted); }
    .spacer { flex: 1; }
  `],
})
export class TaskDetailDialogComponent {
  readonly data = inject<TaskDetailData>(MAT_DIALOG_DATA);
  /** Updated when the user (un)watches it or an admin assigns it. */
  readonly task = signal<Task>(this.data.task);
  /** Emits the task after each change made here, so the page behind can refresh its card. */
  @Output() readonly taskChange = new EventEmitter<Task>();
  readonly labels = STATUS_LABELS;
  readonly overdue = isOverdue(this.data.task);
  readonly progress = checklistProgress(this.data.task);
  private readonly me = toSignal(inject(Store).select(authFeature.selectUser), { initialValue: null });
  readonly watching = computed(() => isWatching(this.task(), this.me()?.id));
  readonly watcherNames = computed(() => this.task().watchers.map((w) => w.fullName).join(', '));
  readonly busy = signal(false);
  private readonly tasks = inject(TaskService);
  private readonly admin = inject(AdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<TaskDetailDialogComponent, number>, { optional: true });
  transferTo = this.data.ownerId;

  toggleWatch(): void {
    this.apply(this.tasks.setWatching(this.task().id, !this.watching()));
  }

  /** Admin: assigns the task to any user (`null` unassigns it), right away. */
  assign(userId: number | null): void {
    this.apply(this.admin.assignTask(this.task().id, userId), (task) =>
      this.snackBar.open(task.assignee ? `Assigned to ${task.assignee.fullName}` : 'Unassigned', 'Close', { duration: 3000 }),
    );
  }

  transfer(): void {
    if (this.transferTo && this.transferTo !== this.data.ownerId) this.dialogRef?.close(this.transferTo);
  }

  private apply(request: Observable<Task>, done?: (task: Task) => void): void {
    this.busy.set(true);
    request.subscribe({
      next: (task) => {
        this.task.set(task);
        this.busy.set(false);
        this.taskChange.emit(task);
        done?.(task);
      },
      error: (e) => {
        this.busy.set(false);
        this.task.update((t) => ({ ...t })); // re-renders the assignee select with the unchanged value
        this.snackBar.open(errorMessage(e), 'Close', { duration: 5000 });
      },
    });
  }
}
