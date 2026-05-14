export const noteKeys = {
  all:          ["subscriberNotes"]                            as const,
  bySubscriber: (id: string) => ["subscriberNotes", id]       as const,
};
