import LucidRepository from '#shared/lucid/lucid_repository'
import IRole from '#interfaces/role_interface'
import Role from '#models/role'

export default class RolesRepository
  extends LucidRepository<typeof Role>
  implements IRole.Repository
{
  constructor() {
    super(Role)
  }

  isAdmin(roles: Role[]): boolean {
    const { ROOT, ADMIN } = IRole.Slugs

    return roles.some((role) => [ROOT, ADMIN].includes(role.slug))
  }

  /**
   * Verify if all provided role IDs exist
   * @param roleIds - Array of role IDs to check
   * @returns true if all roles exist, false otherwise
   */
  async allExist(roleIds: number[]): Promise<boolean> {
    const count = await this.model.query().whereIn('id', roleIds).count('* as total')
    return Number(count[0].$extras.total) === roleIds.length
  }
}
