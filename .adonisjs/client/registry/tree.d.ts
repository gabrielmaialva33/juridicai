/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  healthz: typeof routes['healthz']
  clientErrors: {
    store: typeof routes['client_errors.store']
  }
  auth: {
    signup: {
      create: typeof routes['auth.signup.create']
      store: typeof routes['auth.signup.store']
    }
    login: {
      create: typeof routes['auth.login.create']
      store: typeof routes['auth.login.store']
    }
    logout: typeof routes['auth.logout']
    profile: typeof routes['auth.profile']
  }
  tenants: {
    select: typeof routes['tenants.select'] & {
      store: typeof routes['tenants.select.store']
    }
  }
  settings: {
    tenant: typeof routes['settings.tenant']
    users: typeof routes['settings.users']
  }
  siop: {
    imports: {
      index: typeof routes['siop.imports.index']
      new: typeof routes['siop.imports.new']
      sources: typeof routes['siop.imports.sources']
      jobs: {
        status: typeof routes['siop.imports.jobs.status']
      }
      store: typeof routes['siop.imports.store']
      trf6Export: {
        store: typeof routes['siop.imports.trf6_export.store']
      }
      show: typeof routes['siop.imports.show']
      errors: typeof routes['siop.imports.errors']
      reprocess: typeof routes['siop.imports.reprocess']
      downloadSource: typeof routes['siop.imports.download_source']
    }
  }
  precatorios: {
    index: typeof routes['precatorios.index']
    timeline: typeof routes['precatorios.timeline']
    show: typeof routes['precatorios.show']
  }
  debtors: {
    index: typeof routes['debtors.index']
    show: typeof routes['debtors.show']
  }
  pii: {
    beneficiaries: {
      reveal: typeof routes['pii.beneficiaries.reveal']
    }
  }
  exports: {
    index: typeof routes['exports.index']
    store: typeof routes['exports.store']
    show: typeof routes['exports.show']
    download: typeof routes['exports.download']
  }
  integrations: {
    government: {
      coverage: {
        index: typeof routes['integrations.government.coverage.index']
      }
      dataCoherence: {
        index: typeof routes['integrations.government.data_coherence.index']
      }
    }
    tribunal: {
      budgetExecutions: {
        index: typeof routes['integrations.tribunal.budget_executions.index']
      }
    }
    datajud: {
      candidates: {
        index: typeof routes['integrations.datajud.candidates.index']
        show: typeof routes['integrations.datajud.candidates.show']
        accept: typeof routes['integrations.datajud.candidates.accept']
        reject: typeof routes['integrations.datajud.candidates.reject']
        ambiguous: typeof routes['integrations.datajud.candidates.ambiguous']
      }
    }
  }
  operations: {
    desk: typeof routes['operations.desk']
    opportunities: {
      index: typeof routes['operations.opportunities.index']
      bulkPipeline: typeof routes['operations.opportunities.bulk_pipeline']
      show: typeof routes['operations.opportunities.show']
      liquidity: typeof routes['operations.opportunities.liquidity']
      dossier: typeof routes['operations.opportunities.dossier']
      intelligenceActions: typeof routes['operations.opportunities.intelligence_actions']
      pricing: typeof routes['operations.opportunities.pricing']
      pipeline: typeof routes['operations.opportunities.pipeline']
    }
    pipeline: typeof routes['operations.pipeline']
  }
  legalPublications: {
    index: typeof routes['legal_publications.index']
    monitoring: typeof routes['legal_publications.monitoring'] & {
      cases: {
        store: typeof routes['legal_publications.monitoring.cases.store']
        update: typeof routes['legal_publications.monitoring.cases.update']
        active: typeof routes['legal_publications.monitoring.cases.active']
      }
      barRegistrations: {
        store: typeof routes['legal_publications.monitoring.bar_registrations.store']
        update: typeof routes['legal_publications.monitoring.bar_registrations.update']
        active: typeof routes['legal_publications.monitoring.bar_registrations.active']
      }
    }
    confirm: typeof routes['legal_publications.confirm']
    dismiss: typeof routes['legal_publications.dismiss']
    deadline: {
      update: typeof routes['legal_publications.deadline.update']
    }
    interpretation: {
      update: typeof routes['legal_publications.interpretation.update']
    }
  }
  market: {
    rates: {
      snapshot: typeof routes['market.rates.snapshot']
      syncBcb: typeof routes['market.rates.sync_bcb']
    }
  }
  dashboard: {
    index: typeof routes['dashboard.index']
  }
  admin: {
    health: typeof routes['admin.health']
    jobs: {
      index: typeof routes['admin.jobs.index']
      retry: typeof routes['admin.jobs.retry']
    }
  }
  home: typeof routes['home']
}
