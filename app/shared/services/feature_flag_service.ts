class FeatureFlagService {
  enabled(_flag: string, _tenantId?: string) {
    return true
  }
}

export default new FeatureFlagService()
