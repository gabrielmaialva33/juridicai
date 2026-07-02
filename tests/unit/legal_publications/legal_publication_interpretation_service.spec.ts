import { test } from '@japa/runner'
import { interpretLegalPublication } from '#modules/legal_publications/services/legal_publication_interpretation_service'

test.group('legal publication interpretation', () => {
  test('detects citation with explicit business-day deadline', ({ assert }) => {
    const interpretation = interpretLegalPublication({
      courtAlias: 'TJSP',
      communicationType: 'Intimacao',
      judicialClass: 'Procedimento comum civel',
      text: 'Fica a parte citada para contestar no prazo de 15 dias uteis.',
    })

    assert.equal(interpretation.branch, 'civil')
    assert.equal(interpretation.actType, 'citation')
    assert.equal(interpretation.deadlineDays, 15)
    assert.equal(interpretation.deadlineKind, 'business_days')
    assert.equal(interpretation.confidence, 'high')
    assert.isFalse(interpretation.manualReviewRequired)
  })

  test('flags manifestation without explicit deadline for review', ({ assert }) => {
    const interpretation = interpretLegalPublication({
      courtAlias: 'TRF1',
      communicationType: 'Intimacao',
      judicialClass: 'Cumprimento de sentenca',
      text: 'Manifeste-se sobre os calculos apresentados.',
    })

    assert.equal(interpretation.branch, 'federal')
    assert.equal(interpretation.actType, 'order')
    assert.equal(interpretation.deadlineDays, 5)
    assert.equal(interpretation.deadlineKind, 'business_days')
    assert.equal(interpretation.confidence, 'low')
    assert.isTrue(interpretation.manualReviewRequired)
    assert.include(interpretation.validatorReason, 'manifestation_without_explicit_deadline')
  })

  test('extracts judgment docket date and time', ({ assert }) => {
    const interpretation = interpretLegalPublication({
      courtAlias: 'TJSP',
      communicationType: 'Intimacao',
      judicialClass: 'Recurso inominado',
      text: 'Pauta de julgamento da sessao de julgamento em 10/08/2026 as 14:30.',
    })

    assert.equal(interpretation.actType, 'judgment_docket')
    assert.equal(interpretation.judgmentAt?.toISODate(), '2026-08-10')
    assert.equal(interpretation.hearingAt, null)
    assert.equal(interpretation.hearingTime, null)
    assert.equal(interpretation.priority, 'medium')
  })
})
