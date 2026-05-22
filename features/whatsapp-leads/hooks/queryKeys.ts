export const whatsappLeadKeys = {
  all:              ()              => ["whatsappLeads"]                             as const,
  lists:            ()              => ["whatsappLeads", "list"]                     as const,
  list:             (date: string)  => ["whatsappLeads", "list", date]               as const,
  analytics:        (date: string)  => ["whatsappLeads", "analytics", date]          as const,
  monthlyAnalytics: (month: string) => ["whatsappLeads", "monthlyAnalytics", month]  as const,
  detail:           (id: string)    => ["whatsappLeads", "detail", id]               as const,
  messages:         (leadId: string) => ["whatsappLeads", "messages", leadId]        as const,
  cannedResponses:  ()               => ["whatsappLeads", "cannedResponses"]         as const,
  history:          (phone: string)  => ["whatsappLeads", "history", phone]          as const,
} as const;
