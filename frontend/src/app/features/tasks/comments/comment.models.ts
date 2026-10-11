export interface TaskComment {
  id: number;
  body: string;
  author: { id: number; fullName: string };
  createdAt: string;
  /** True for the comment's author, the task's owner and admins. */
  canDelete: boolean;
}
