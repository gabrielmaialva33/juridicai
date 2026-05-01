import { BaseSeeder } from '@adonisjs/lucid/seeders'
import {
  seedMembershipsAndRoles,
  seedPermissions,
  seedRoles,
  seedTenant,
  seedUsers,
} from '#database/seeders/support/access_seed'
import { seedRadarDataset } from '#database/seeders/support/radar_dataset_seed'
import { seedMarketRates, seedRetentionPolicy } from '#database/seeders/support/platform_seed'

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
