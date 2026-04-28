import { JudicialProcessSchema } from '#database/schema'

export default class JudicialProcess extends JudicialProcessSchema {
  static softDeletes = true
}
