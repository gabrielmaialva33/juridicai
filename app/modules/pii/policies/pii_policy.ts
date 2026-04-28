import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#modules/auth/models/user'

export default class PiiPolicy extends BasePolicy {
  reveal(_user: User) {
    return false
  }
}
