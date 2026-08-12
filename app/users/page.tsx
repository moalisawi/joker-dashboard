import { redirect } from "next/navigation";

/**
 * `/users` and `/admin/employees` were two consoles for one job.
 *
 * They had drifted into a split where neither was complete: `/users` could
 * change an authority role and set the four account statuses but knew nothing
 * about teams, jobs or assigned data; `/admin/employees` could edit jobs, teams
 * and permissions but could not promote anyone or see a last login, and it
 * queried `isEmployee == true`, so the owners and admins it was supposed to
 * administer were missing from it entirely. Which page you happened to open
 * decided what you were allowed to do.
 *
 * Everything `/users` did — the role control, the status transitions, last
 * login, and the ghost-account check against Firebase Auth — now lives in
 * `/admin/employees`, which is the single console. This redirect keeps old
 * links and bookmarks working.
 *
 * Matches the existing `/employees` → `/admin/employees` redirect.
 */
export default function UsersRedirect() {
  redirect("/admin/employees");
}
