/**
 * Authorization for WhatsApp lead operations.
 *
 * /api/whatsapp-operations called verifyServerUser and nothing else, so all nine
 * of its operations — reassigning, retagging, changing status, sending a message
 * as the business, creating leads — were open to any authenticated account at
 * any role against any lead id. A subscriber was better protected than the
 * pipeline that produces one.
 */
import {
  LEAD_OPERATION_PERMISSION,
  canAssignLeadTo,
  canMutateLead,
  leadOwnerUid,
  type LeadAccessActor,
  type LeadOperation,
} from '@/lib/serverLeadAccess'

const EMP = 'uid-employee-1'
const OTHER = 'uid-employee-2'

const employee: LeadAccessActor = { uid: EMP, role: 'employee' }
const owner: LeadAccessActor = { uid: 'uid-owner', role: 'owner' }
const admin: LeadAccessActor = { uid: 'uid-admin', role: 'admin' }

const MUTATING_OPS: LeadOperation[] = [
  'updateLeadStatus', 'sendMessage', 'addNote', 'removeNote',
  'updateTags', 'assignLead', 'updateConversationStatus',
]

describe('LEAD_OPERATION_PERMISSION', () => {
  it('requires a permission for every state-changing operation', () => {
    for (const op of MUTATING_OPS) {
      expect(LEAD_OPERATION_PERMISSION[op as keyof typeof LEAD_OPERATION_PERMISSION]).toBeDefined()
    }
  })

  it('gates creating a lead on create, not edit', () => {
    expect(LEAD_OPERATION_PERMISSION.createLead).toEqual(['subscribers', 'create'])
  })

  it('gates reassignment on assign — a supervisor action', () => {
    expect(LEAD_OPERATION_PERMISSION.assignLead).toEqual(['subscribers', 'assign'])
  })

  it('leaves markAsRead ungated', () => {
    // Marking a conversation you can already see as read changes no business
    // state; gating it would make the inbox unusable.
    expect('markAsRead' in LEAD_OPERATION_PERMISSION).toBe(false)
  })
})

describe('leadOwnerUid', () => {
  it('reads either field spelling', () => {
    expect(leadOwnerUid({ assignedTo: EMP })).toBe(EMP)
    expect(leadOwnerUid({ assignedToUid: EMP })).toBe(EMP)
  })

  it('prefers assignedToUid when both are present', () => {
    expect(leadOwnerUid({ assignedToUid: EMP, assignedTo: OTHER })).toBe(EMP)
  })

  it('treats missing, empty and non-string as unowned', () => {
    expect(leadOwnerUid(null)).toBe('')
    expect(leadOwnerUid({})).toBe('')
    expect(leadOwnerUid({ assignedTo: '' })).toBe('')
    expect(leadOwnerUid({ assignedTo: 42 })).toBe('')
  })
})

describe('canMutateLead', () => {
  it.each(MUTATING_OPS)('lets an employee %s an unassigned lead', (op) => {
    // Leads arrive unowned and whoever picks one up works it — that is the
    // pipeline. Locking unassigned leads would stop the inbox working.
    expect(canMutateLead(employee, {}, op).allowed).toBe(true)
  })

  it.each(MUTATING_OPS)('lets an employee %s their own lead', (op) => {
    expect(canMutateLead(employee, { assignedTo: EMP }, op).allowed).toBe(true)
  })

  it.each(MUTATING_OPS)('refuses an employee %s on a colleague\'s lead', (op) => {
    const decision = canMutateLead(employee, { assignedTo: OTHER }, op)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBeTruthy()
  })

  it.each([owner, admin])('leaves $role unscoped', (actor) => {
    expect(canMutateLead(actor, { assignedTo: OTHER }, 'sendMessage').allowed).toBe(true)
  })

  it('refuses when the lead does not exist', () => {
    expect(canMutateLead(employee, null, 'sendMessage').allowed).toBe(false)
  })

  it('does not name the current owner when refusing', () => {
    expect(canMutateLead(employee, { assignedTo: OTHER }, 'sendMessage').reason).not.toContain(OTHER)
  })
})

describe('canAssignLeadTo', () => {
  it('lets an employee claim an unassigned lead', () => {
    expect(canAssignLeadTo(employee, {}, EMP).allowed).toBe(true)
  })

  it('lets an employee release their own lead', () => {
    expect(canAssignLeadTo(employee, { assignedTo: EMP }, null).allowed).toBe(true)
    expect(canAssignLeadTo(employee, { assignedTo: EMP }, '').allowed).toBe(true)
  })

  it('refuses pushing a lead onto a colleague', () => {
    expect(canAssignLeadTo(employee, {}, OTHER).allowed).toBe(false)
  })

  it('refuses taking a lead assigned to someone else', () => {
    expect(canAssignLeadTo(employee, { assignedTo: OTHER }, EMP).allowed).toBe(false)
  })

  it('lets an owner move a lead between any two people', () => {
    expect(canAssignLeadTo(owner, { assignedTo: OTHER }, EMP).allowed).toBe(true)
  })
})
