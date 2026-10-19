/** The "@…" being typed right before the caret: where its "@" is and what follows it. */
export interface MentionQuery {
  start: number;
  query: string;
}

export type CommentPart = { text: string; mention: false } | { text: string; mention: true };

const MAX_QUERY = 40;

/**
 * The mention being typed at the caret, or null. An "@" only starts one at the beginning or after a space or a new
 * line (so emails don't), and it may span spaces ("@Alice Ma") but not lines.
 */
export function mentionQuery(text: string, caret: number): MentionQuery | null {
  if (caret < 1) return null;
  const start = text.lastIndexOf('@', caret - 1);
  if (start < 0 || (start > 0 && !/\s/.test(text[start - 1]))) return null;
  const query = text.slice(start + 1, caret);
  if (query.length > MAX_QUERY || /[\n@]/.test(query) || query.startsWith(' ')) return null;
  return { start, query };
}

/** Users whose full name, or one of its words, starts with the query; at most `limit`. */
export function matchUsers<U extends { fullName: string }>(users: readonly U[], query: string, limit = 6): U[] {
  const q = query.toLowerCase();
  return users
    .filter((u) => {
      const name = u.fullName.toLowerCase();
      return name.startsWith(q) || name.split(/\s+/).some((word) => word.startsWith(q));
    })
    .slice(0, limit);
}

/** Splits a comment into plain text and "@Full Name" mentions of the given names (longest name wins). */
export function splitMentions(body: string, names: readonly string[]): CommentPart[] {
  const sorted = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  const lower = body.toLowerCase();
  const parts: CommentPart[] = [];
  let plainFrom = 0;
  let i = 0;
  while ((i = body.indexOf('@', i)) >= 0) {
    const atWordStart = i === 0 || /\s/.test(body[i - 1]);
    const name = atWordStart
      ? sorted.find((n) => lower.startsWith(n.toLowerCase(), i + 1) && !/[\p{L}\p{N}]/u.test(body[i + 1 + n.length] ?? ''))
      : undefined;
    if (!name) {
      i++;
      continue;
    }
    if (i > plainFrom) parts.push({ text: body.slice(plainFrom, i), mention: false });
    const end = i + 1 + name.length;
    parts.push({ text: body.slice(i, end), mention: true });
    plainFrom = i = end;
  }
  if (plainFrom < body.length) parts.push({ text: body.slice(plainFrom), mention: false });
  return parts;
}
