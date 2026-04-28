import metricsRepository from '#modules/dashboard/repositories/metrics_repository'

class DashboardService {
  async overview(tenantId: string) {
    const [assetMetrics, debtorAggregates] = await Promise.all([
      metricsRepository.assetMetrics(tenantId),
      metricsRepository.debtorAggregates(tenantId),
    ])

    return { assetMetrics, debtorAggregates }
  }
}

export default new DashboardService()
