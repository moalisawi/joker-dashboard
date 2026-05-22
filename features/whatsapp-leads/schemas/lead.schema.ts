import { z } from "zod";
import { LeadStatus } from "@/types/whatsapp-lead";

export const updateLeadStatusSchema = z.object({
  id:     z.string().min(1, "المعرّف مطلوب"),
  status: z.enum([
    LeadStatus.INTERESTED,
    LeadStatus.READY_TO_PAY,
    LeadStatus.IMPORTANT_FOLLOW_UP,
    LeadStatus.NEW,
    LeadStatus.RETARGETING,
  ]),
});

export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
