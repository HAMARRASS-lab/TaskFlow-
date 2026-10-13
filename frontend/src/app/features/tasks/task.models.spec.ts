import { checklistProgress, collectLabels, labelColor, normalizeLabel } from './task.models';

describe('task label helpers', () => {
  it('normalizes labels like the API', () => {
    expect(normalizeLabel('  Front   End ')).toBe('front end');
  });

  it('gives each label a stable colour', () => {
    expect(labelColor('bug')).toEqual(labelColor('bug'));
    expect(labelColor('bug').background).toMatch(/^#/);
  });

  it('collects distinct sorted labels', () => {
    expect(collectLabels([{ labels: ['ui', 'bug'] }, { labels: ['bug'] }, { labels: [] }])).toEqual(['bug', 'ui']);
  });
});

describe('checklistProgress', () => {
  it('counts done items', () => {
    const checklist = [{ id: 1, title: 'a', done: true }, { id: 2, title: 'b', done: false }, { id: 3, title: 'c', done: true }];
    expect(checklistProgress({ checklist })).toEqual({ done: 2, total: 3, percent: 67 });
    expect(checklistProgress({ checklist: [] })).toEqual({ done: 0, total: 0, percent: 0 });
  });
});
