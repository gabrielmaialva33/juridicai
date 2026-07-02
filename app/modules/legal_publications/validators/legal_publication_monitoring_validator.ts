import vine from '@vinejs/vine'

export const monitoredCaseValidator = vine.create({
  cnjNumber: vine.string().trim().minLength(10).maxLength(40),
  label: vine.string().trim().maxLength(120).nullable(),
  clientPartySide: vine.enum(['plaintiff', 'defendant']).nullable(),
  monitoredBarRegistrationId: vine.string().uuid().nullable(),
})

export const monitoredBarRegistrationValidator = vine.create({
  barNumber: vine.string().trim().minLength(1).maxLength(32),
  stateCode: vine.string().trim().minLength(2).maxLength(2),
  lawyerName: vine.string().trim().maxLength(120).nullable(),
})

export const monitoringActiveToggleValidator = vine.create({
  active: vine.boolean(),
})
