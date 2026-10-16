import { Component, Input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserSummary, initials, labelColor } from '../task.models';

/** A round badge with the user's initials; the colour is derived from the user, the tooltip names them. */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [MatTooltipModule],
  template: `<span class="avatar" [style.background]="colors.background" [style.color]="colors.color"
                   [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.4"
                   [matTooltip]="tooltip ? tooltip + user.fullName : ''" [attr.aria-label]="(tooltip ?? '') + user.fullName"
                   role="img" data-cy="user-avatar">{{ letters }}</span>`,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .avatar {
      display: grid; place-items: center; border-radius: 50%; font-weight: 600; line-height: 1;
      box-shadow: 0 0 0 2px var(--tf-surface); user-select: none;
    }
  `],
})
export class UserAvatarComponent {
  @Input({ required: true }) user!: UserSummary;
  @Input() size = 26;
  /** Tooltip prefix, e.g. "Assigned to "; `null` = no tooltip. */
  @Input() tooltip: string | null = '';

  get letters(): string {
    return initials(this.user.fullName);
  }

  get colors(): { background: string; color: string } {
    return labelColor(`user-${this.user.id}`);
  }
}
