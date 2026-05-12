/**
 * Services Index
 * Centralized exports for all business logic services
 */

export { subscriberService } from "./subscribers.service";
export { freezeService } from "./freeze.service";
export { paymentService } from "./payments.service";
export { refundService } from "./refunds.service";
export { withdrawalService } from "./withdrawal.service";
export { analyticsService } from "./analytics.service";
export { userService } from "./users.service";
export { permissionService } from "./permission.service";
export { auditService } from "./audit.service";
export { notificationService } from "./notification.service";
export { alertEngineService } from "./alert-engine.service";
export { teamsService }               from "./teams.service";
export { subscriberNotesService }     from "./subscriberNotes.service";
export { subscriberAssignmentService } from "./subscriberAssignment.service";
// emailService is server-only — import directly from "@/services/email.service" in API routes only
