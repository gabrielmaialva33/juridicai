import { DebtorSchema } from '#database/schema'

export default class Debtor extends DebtorSchema {
  static softDeletes = true
}
