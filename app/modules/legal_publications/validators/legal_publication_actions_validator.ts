import vine from '@vinejs/vine'

export const legalPublicationManualDeadlineValidator = vine.create({
  manualDueAt: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

export const legalPublicationInterpretationEditValidator = vine.create({
  determination: vine.string().trim().maxLength(500).nullable(),
  actType: vine.string().trim().maxLength(80).nullable(),
  recommendedAction: vine.string().trim().maxLength(500).nullable(),
  legalBasis: vine.string().trim().maxLength(160).nullable(),
  deadlineDays: vine.number().min(1).max(365).nullable(),
  deadlineKind: vine.enum(['business_days', 'calendar_days']).nullable(),
  hearingAt: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  hearingTime: vine
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  judgmentAt: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  priority: vine.enum(['high', 'medium', 'low']).nullable(),
  notes: vine.string().trim().maxLength(1000).nullable(),
})
