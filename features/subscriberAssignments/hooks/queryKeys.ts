export const assignmentKeys = {
  all:          ["subscriberAssignments"]                              as const,
  bySubscriber: (id: string) => ["subscriberAssignments", id]         as const,
  byEmployee:   (uid: string) => ["subscriberAssignments", "emp", uid] as const,
};
