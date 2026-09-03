/**
 * Email duplicate detection — detects when the same email arrived in
 * both mailboxes (apoio.cliente and geral) within a short time window.
 * Does NOT merge threads — just provides a visual warning.
 */

export interface EmailThreadLike {
  id: string;
  from_address: string;
  subject: string;
  mailbox: string;
  date_created: string;
}

/** Normalize subject: remove Re:, Fwd:, FW:, RE: prefixes and extra whitespace */
function normalizeSubject(subject: string): string {
  return (subject || "")
    .replace(/^\s*(re|fwd|fw|enc)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Check if two dates are within N minutes of each other */
function withinMinutes(a: string, b: string, minutes: number): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return false;
  return Math.abs(ta - tb) <= minutes * 60 * 1000;
}

/**
 * Find a potential duplicate thread from a different mailbox.
 * Returns the matching thread or null.
 */
export function findPotentialDuplicateThread(
  thread: EmailThreadLike,
  allThreads: EmailThreadLike[],
): EmailThreadLike | null {
  if (!thread.from_address || !thread.subject) return null;

  const normalizedSubject = normalizeSubject(thread.subject);
  const fromLower = thread.from_address.toLowerCase().trim();

  for (const other of allThreads) {
    // Must be a different thread
    if (other.id === thread.id) continue;
    // Must be a different mailbox
    if (other.mailbox === thread.mailbox) continue;
    // Same sender
    if (other.from_address?.toLowerCase().trim() !== fromLower) continue;
    // Similar subject
    if (normalizeSubject(other.subject) !== normalizedSubject) continue;
    // Within 10 minutes
    if (!withinMinutes(thread.date_created, other.date_created, 10)) continue;

    return other;
  }

  return null;
}
