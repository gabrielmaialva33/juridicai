import { BaseCommand, flags } from '@adonisjs/core/ace'
import betaReadinessService from '#modules/admin/services/beta_readiness_service'
import queueService from '#shared/services/queue_service'

export default class BetaReadiness extends BaseCommand {
  static commandName = 'beta:readiness'
  static description =
    'Inspect whether a clean environment has the minimum backend bootstrap, jobs, and data evidence for beta'
  static options = {
    startApp: true,
  }

  @flags.string({
    description: 'Tenant id to inspect. Defaults to the local bootstrap tenant slug.',
  })
  declare tenantId?: string

  @flags.string({
    description: 'Tenant slug to inspect when --tenant-id is not provided.',
  })
  declare tenantSlug?: string

  @flags.boolean({
    description: 'Emit raw JSON only.',
  })
  declare json: boolean

  @flags.boolean({
    description: 'Exit with code 1 when the report has warnings or failures.',
  })
  declare strict: boolean

  async run() {
    const report = await betaReadinessService.build({
      tenantId: this.tenantId,
      tenantSlug: this.tenantSlug,
    })

    if (this.json) {
      this.logger.info(JSON.stringify(report, null, 2))
    } else {
      this.logger.info(`Beta readiness status: ${report.status}`)
      this.logger.info(
        `Checks: ${JSON.stringify({
          sections: report.summary.sections,
          passed: report.summary.passed,
          warnings: report.summary.warnings,
          failures: report.summary.failures,
          checks: report.summary.checks,
        })}`
      )

      for (const section of report.sections) {
        this.logger.info(`${section.label}: ${section.status}`)
        for (const check of section.checks) {
          this.logger.info(
            `  [${check.status}] ${check.key}: ${check.message} (${JSON.stringify({
              actual: check.actual ?? null,
              expected: check.expected ?? null,
            })})`
          )
        }
      }

      if (report.nextActions.length > 0) {
        this.logger.info(`Next actions: ${JSON.stringify(report.nextActions)}`)
      }
    }

    await queueService.shutdown()

    if (report.status === 'fail' || (this.strict && report.status !== 'pass')) {
      this.exitCode = 1
    }
  }
}
