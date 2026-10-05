import { FormControl, FormGroup } from '@angular/forms';
import { timeRangeValidator } from './meeting-form-dialog.component';

describe('timeRangeValidator', () => {
  const group = (start: string, end: string) =>
    new FormGroup({ start: new FormControl(start), end: new FormControl(end) });

  it('accepts an end time after the start time', () => {
    expect(timeRangeValidator(group('09:00', '10:30'))).toBeNull();
  });

  it('rejects an empty or reversed range', () => {
    expect(timeRangeValidator(group('10:00', '10:00'))).toEqual({ timeRange: true });
    expect(timeRangeValidator(group('14:00', '09:00'))).toEqual({ timeRange: true });
  });
});
