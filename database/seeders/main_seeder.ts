import { BaseSeeder } from '@adonisjs/lucid/seeders'
import {
  seedMembershipsAndRoles,
  seedPermissions,
  seedRoles,
  seedTenant,
  seedUsers,
} from './support/access_seed.js'
import { seedMarketRates, seedRetentionPolicy } from './support/platform_seed.js'
import { seedRadarDataset } from './support/radar_dataset_seed.js'

export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const permissions = await seedPermissions()
    const roles = await seedRoles(permissions)
    const tenant = await seedTenant()
    const users = await seedUsers()

    await seedMembershipsAndRoles(tenant, users, roles)
    await seedRetentionPolicy(tenant)
    await seedMarketRates()
    await seedRadarDataset(tenant, users.owner)
  }
}
