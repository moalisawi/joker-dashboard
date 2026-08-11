// Notes are read through this module and written through the parallel stack in
// hooks/useSubscriberNotes.ts, which NotesPanel uses. The read/write split is
// not by design — the two stacks were built independently — but only the read
// half of this one was ever wired up.
//
// AddNoteForm, NoteTimeline and useNoteMutations lived here and were exported
// but never rendered or called from anywhere: every consumer imports the
// mutations from @/hooks/useSubscriberNotes instead. They were removed rather
// than kept as a second, subtly different implementation of writing a note —
// having two made a real bug: a fix threaded convincedByUid through this stack,
// which nothing calls, and the live path kept stamping the wrong uid.
export { noteKeys }           from "./hooks/queryKeys";
export { useSubscriberNotes } from "./hooks/useSubscriberNotes";
