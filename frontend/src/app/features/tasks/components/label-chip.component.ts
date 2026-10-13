import { Component, Input } from '@angular/core';
import { labelColor } from '../task.models';

/** A coloured pill for a task label; the colour is derived from the name. */
@Component({
  selector: 'app-label-chip',
  standalone: true,
  template: `<span class="chip" [style.background]="colors.background" [style.color]="colors.color"
                   data-cy="label-chip">{{ label }}</span>`,
  styles: [`
    :host { display: inline-flex; min-width: 0; }
    .chip {
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 11.5px; font-weight: 500; line-height: 1; padding: 4px 9px; border-radius: 99px;
    }
  `],
})
export class LabelChipComponent {
  @Input({ required: true }) label!: string;

  get colors(): { background: string; color: string } {
    return labelColor(this.label);
  }
}
