import { z } from "zod";
import { ASSIGNMENT_TYPE } from "@/constants/subscriberWorkflow";

const assignmentTypeValues = Object.values(ASSIGNMENT_TYPE) as [string, ...string[]];

export const assignSubscriberSchema = z.object({
  subscriberId:              z.string().min(1),
  subscriberName:            z.string().default(""),

  assignedSalesId:           z.string().nullable().optional(),
  assignedSalesName:         z.string().nullable().optional(),
  assignedNutritionistId:    z.string().nullable().optional(),
  assignedNutritionistName:  z.string().nullable().optional(),
  assignedTeamId:            z.string().nullable().optional(),
  assignedTeamName:          z.string().nullable().optional(),

  assignmentType:            z.enum(assignmentTypeValues as [string, ...string[]]),
  reason:                    z.string().max(300).optional(),
});

export type AssignSubscriberInput = z.infer<typeof assignSubscriberSchema>;

export const transferSubscriberSchema = assignSubscriberSchema.extend({
  reason: z.string().min(1, "يجب ذكر سبب النقل").max(300),
});

export type TransferSubscriberInput = z.infer<typeof transferSubscriberSchema>;
