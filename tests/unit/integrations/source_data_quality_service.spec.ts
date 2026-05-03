import { test } from '@japa/runner'
import sourceDataQualityService from '#modules/integrations/services/source_data_quality_service'

test.group('Source data quality service', () => {
  test('scores import metrics using row validity, import yield, field coverage, and errors', ({
    assert,
  }) => {
    const quality = sourceDataQualityService.summarizeMetrics({
      genericPrecatorioImports: [
        {
          stats: {
            totalRows: 10,
            validRows: 8,
            selectedRows: 8,
            inserted: 3,
            updated: 4,
            errors: 1,
          },
          extraction: {
            completeness: {
              cnjCoverage: 0.8,
              valueCoverage: 0.7,
              yearCoverage: 0.9,
              debtorCoverage: 0.6,
            },
          },
        },
      ],
    })

    assert.equal(quality.totalRows, 10)
    assert.equal(quality.validRows, 8)
    assert.equal(quality.selectedRows, 8)
    assert.equal(quality.importedRows, 7)
    assert.equal(quality.errorRows, 1)
    assert.equal(quality.validRowCoverage, 0.8)
    assert.equal(quality.importYield, 0.875)
    assert.equal(quality.errorRate, 0.1111)
    assert.equal(quality.fieldCoverage.average, 0.75)
    assert.equal(quality.score, 0.8214)
    assert.equal(quality.grade, 'B')
  })

  test('falls back to aggregate totals when detailed imports are unavailable', ({ assert }) => {
    const quality = sourceDataQualityService.summarizeMetrics({
      importTotals: {
        totalRows: 100,
        validRows: 90,
        selectedRows: 80,
        inserted: 60,
        updated: 10,
        errors: 5,
      },
    })

    assert.equal(quality.totalRows, 100)
    assert.equal(quality.validRowCoverage, 0.9)
    assert.equal(quality.importYield, 0.875)
    assert.equal(quality.errorRate, 0.0588)
    assert.equal(quality.grade, 'A')
  })
})
