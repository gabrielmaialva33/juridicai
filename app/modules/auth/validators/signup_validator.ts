import vine from '@vinejs/vine'

const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

export const signupValidator = vine.create({
  fullName: vine.string().nullable(),
  organizationName: vine.string().trim().minLength(2).maxLength(120),
  organizationDocument: vine.string().trim().maxLength(32).nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password().confirmed({
    confirmationField: 'passwordConfirmation',
  }),
})
