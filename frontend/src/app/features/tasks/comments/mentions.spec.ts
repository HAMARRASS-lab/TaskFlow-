import { matchUsers, mentionQuery, splitMentions } from './mentions';

describe('mentions', () => {
  it('finds the mention being typed at the caret', () => {
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('Hi @ali', 7)).toEqual({ start: 3, query: 'ali' });
    expect(mentionQuery('Hi @Alice Ma', 12)).toEqual({ start: 3, query: 'Alice Ma' });
    expect(mentionQuery('line\n@bo', 8)).toEqual({ start: 5, query: 'bo' });
  });

  it('ignores emails, other lines, a leading space and a caret before the @', () => {
    expect(mentionQuery('mail bob@test.com', 17)).toBeNull();
    expect(mentionQuery('@bob\nnext', 9)).toBeNull();
    expect(mentionQuery('@ bob', 5)).toBeNull();
    expect(mentionQuery('@bob', 0)).toBeNull();
    expect(mentionQuery('no mention', 10)).toBeNull();
  });

  it('matches users by the start of their name or of any of its words', () => {
    const users = [{ fullName: 'Alice Martin' }, { fullName: 'Bob Durand' }, { fullName: 'Marc Alba' }];
    expect(matchUsers(users, 'ma').map((u) => u.fullName)).toEqual(['Alice Martin', 'Marc Alba']);
    expect(matchUsers(users, 'Alice M').map((u) => u.fullName)).toEqual(['Alice Martin']);
    expect(matchUsers(users, '', 2).length).toBe(2);
  });

  it('splits a comment into text and mentions, preferring the longest name', () => {
    expect(splitMentions('Ping @alice martin and @Bob, not me@bob or @Bobby', ['Alice', 'Alice Martin', 'Bob'])).toEqual([
      { text: 'Ping ', mention: false },
      { text: '@alice martin', mention: true },
      { text: ' and ', mention: false },
      { text: '@Bob', mention: true },
      { text: ', not me@bob or @Bobby', mention: false },
    ]);
    expect(splitMentions('plain', [])).toEqual([{ text: 'plain', mention: false }]);
  });
});
