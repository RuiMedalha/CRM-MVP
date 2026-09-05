export interface NotesValue { notes: string; internal_notes: string }
export interface NotesState {
  saved: NotesValue; draft: NotesValue; saving: boolean; error: string | null;
  conflict: boolean; remote: NotesValue | null; confirmed: boolean;
}
export type NotesEvent =
  | { type: "edit"; field: keyof NotesValue; value: string }
  | { type: "remote"; value: NotesValue }
  | { type: "saving" }
  | { type: "saved"; value: NotesValue }
  | { type: "failed"; message: string }
  | { type: "accept-remote" };

export function equalNotes(a: NotesValue, b: NotesValue): boolean {
  return a.notes === b.notes && a.internal_notes === b.internal_notes;
}
export function initialNotes(value: NotesValue): NotesState {
  return { saved: value, draft: value, saving: false, error: null, conflict: false, remote: null, confirmed: false };
}
export function notesReducer(state: NotesState, event: NotesEvent): NotesState {
  switch (event.type) {
    case "edit": return { ...state, draft: { ...state.draft, [event.field]: event.value }, confirmed: false };
    case "remote":
      if (equalNotes(event.value, state.saved)) return state;
      if (!equalNotes(state.draft, state.saved) || state.saving) return { ...state, conflict: true, remote: event.value };
      return initialNotes(event.value);
    case "saving": return { ...state, saving: true, error: null, confirmed: false };
    case "saved": return { ...state, saved: event.value, saving: false, error: null, conflict: false, remote: null, confirmed: equalNotes(state.draft, event.value) };
    case "failed": return { ...state, saving: false, error: event.message, confirmed: false };
    case "accept-remote": return state.remote ? initialNotes(state.remote) : state;
  }
}

export function notesDraftKey(userId: string, contactId: string): string {
  return `heq:notes:v13:${encodeURIComponent(userId)}:${encodeURIComponent(contactId)}`;
}
export function restoreNotes(value: NotesValue, stored: string | null, now: number): NotesState {
  const fresh = initialNotes(value);
  if (!stored) return fresh;
  try {
    const record = JSON.parse(stored);
    const isValue = (v: unknown): v is NotesValue => !!v && typeof v === "object" &&
      typeof (v as NotesValue).notes === "string" && typeof (v as NotesValue).internal_notes === "string";
    if (!isValue(record.draft) || !isValue(record.saved) || !Number.isFinite(record.at) || record.at > now || now - record.at > 86400000) return fresh;
    if (equalNotes(value, record.draft)) return fresh;
    return { ...fresh, saved: record.saved, draft: record.draft, conflict: !equalNotes(value, record.saved), remote: !equalNotes(value, record.saved) ? value : null };
  } catch { return fresh; }
}
