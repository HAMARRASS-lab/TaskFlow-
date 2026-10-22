import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { errorMessage } from '../../core/api';
import { AdminService } from './admin.service';

export interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  error?: boolean;
}

/** Admin chat bot: ask questions about tasks ("How many tasks are to do?"). */
@Component({
  selector: 'app-admin-assistant',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule],
  template: `
    <section class="assistant" data-cy="assistant">
      <header>
        <mat-icon>smart_toy</mat-icon>
        <h2>Assistant</h2>
      </header>
      <div class="messages" #scroller>
        @for (m of messages(); track $index) {
          <p class="msg" [class.user]="m.from === 'user'" [class.error]="m.error" data-cy="assistant-message">{{ m.text }}</p>
        } @empty {
          <div class="suggestions">
            @for (s of suggestions; track s) {
              <button mat-stroked-button type="button" (click)="ask(s)" data-cy="assistant-suggestion">{{ s }}</button>
            }
          </div>
        }
        @if (sending()) { <p class="msg typing" aria-live="polite">Thinking…</p> }
      </div>
      <form (ngSubmit)="ask(draft)">
        <input name="message" [(ngModel)]="draft" placeholder="Ask about tasks…" maxlength="1000"
               autocomplete="off" aria-label="Message to the assistant" data-cy="assistant-input" />
        <button mat-icon-button type="submit" [disabled]="sending() || !draft.trim()" aria-label="Send"
                data-cy="assistant-send">
          <mat-icon>send</mat-icon>
        </button>
      </form>
    </section>
  `,
  styles: [`
    .assistant {
      display: flex; flex-direction: column; margin-bottom: 24px; background: var(--tf-surface);
      border: 1px solid var(--tf-border); border-radius: var(--tf-radius); box-shadow: var(--tf-shadow);
    }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--tf-border); }
    header mat-icon { color: var(--tf-accent); }
    h2 { margin: 0; font-size: 16px; font-weight: 600; }
    .messages { display: flex; flex-direction: column; gap: 8px; padding: 16px; max-height: 320px; overflow-y: auto; }
    .msg {
      margin: 0; padding: 8px 12px; max-width: 80%; border-radius: 12px; font-size: 14px; white-space: pre-wrap;
      align-self: flex-start; background: #f1f2f6; color: var(--tf-text);
    }
    .msg.user { align-self: flex-end; background: var(--tf-accent); color: #fff; }
    .msg.error { background: #fdecec; color: var(--tf-high); }
    .msg.typing { color: var(--tf-muted); font-style: italic; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
    form { display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 16px; border-top: 1px solid var(--tf-border); }
    input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 14px; color: var(--tf-text); }
    form button { color: var(--tf-accent); }
  `],
})
export class AdminAssistantComponent {
  private readonly admin = inject(AdminService);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly suggestions = ['How many tasks are to do?', 'Who has the most tasks to do?', 'Tasks per status'];
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);
  draft = '';

  ask(text: string): void {
    const message = text.trim();
    if (!message || this.sending()) return;
    this.draft = '';
    this.push({ from: 'user', text: message });
    this.sending.set(true);
    this.admin.chat(message).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.push({ from: 'bot', text: res.reply });
      },
      error: (e) => {
        this.sending.set(false);
        this.push({ from: 'bot', text: errorMessage(e), error: true });
      },
    });
  }

  private push(message: ChatMessage): void {
    this.messages.update((list) => [...list, message]);
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
