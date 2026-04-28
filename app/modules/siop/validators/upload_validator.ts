import vine from '@vinejs/vine'

export const uploadValidator = vine.create({
  exerciseYear: vine.number().min(2010).max(2100),
})
