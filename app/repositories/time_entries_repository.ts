import TimeEntry from '#models/time_entry'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class TimeEntriesRepository extends LucidRepository<typeof TimeEntry> {
  constructor() {
    super(TimeEntry)
  }
}
