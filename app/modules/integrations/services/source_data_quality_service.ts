import type { JsonRecord } from '#shared/types/model_enums'

export type SourceDataQualitySummary = {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  totalRows: number
  validRows: number
  selectedRows: number
  importedRows: number
  errorRows: number
  validRowCoverage: number
  importYield: number
  errorRate: number
  fieldCoverage: {
    cnj: number | null
    value: number | null
    year: number | null
    debtor: number | null
    average: number | null
  }
}

type FieldCoverageItem = {
  cnj: number | null
  value: number | null
  year: number | null
  debtor: number | null
}

type QualityTotals = {
  totalRows: number
  validRows: number
  selectedRows: number
  importedRows: number
  errorRows: number
  fieldCoverages: FieldCoverageItem[]
}

class SourceDataQualityService {
  summarizeMetrics(metrics: JsonRecord | null | undefined): SourceDataQualitySummary {
    const imports = importEntries(metrics)
    const totals = imports.reduce<QualityTotals>(
      (accumulator, item) => {
        const stats = recordField(item.stats)
        const extraction = recordField(item.extraction)

        return {
          totalRows: accumulator.totalRows + numberField(stats.totalRows),
          validRows: accumulator.validRows + numberField(stats.validRows),
          selectedRows: accumulator.selectedRows + numberField(stats.selectedRows),
          importedRows:
            accumulator.importedRows + numberField(stats.inserted) + numberField(stats.updated),
          errorRows: accumulator.errorRows + numberField(stats.errors),
          fieldCoverages: [...accumulator.fieldCoverages, ...fieldCoveragesFrom(extraction)],
        }
      },
      {
        totalRows: 0,
        validRows: 0,
        selectedRows: 0,
        importedRows: 0,
        errorRows: 0,
        fieldCoverages: [],
      }
    )
    const importTotals = recordField(metrics?.importTotals)
    const totalRows = totals.totalRows || numberField(importTotals.totalRows)
    const validRows = totals.validRows || numberField(importTotals.validRows)
    const selectedRows = totals.selectedRows || numberField(importTotals.selectedRows)
    const importedRows =
      totals.importedRows || numberField(importTotals.inserted) + numberField(importTotals.updated)
    const errorRows = totals.errorRows || numberField(importTotals.errors)
    const validRowCoverage = ratio(validRows, totalRows || selectedRows || validRows)
    const importYield = ratio(importedRows, selectedRows || validRows || importedRows)
    const errorRate = ratio(errorRows, (selectedRows || validRows || importedRows) + errorRows)
    const fieldCoverage = summarizeFieldCoverage(totals.fieldCoverages)
    const fieldCoverageScore = fieldCoverage.average ?? validRowCoverage
    const score = round4(
      0.4 * validRowCoverage + 0.3 * importYield + 0.2 * fieldCoverageScore + 0.1 * (1 - errorRate)
    )

    return {
      score,
      grade: gradeFor(score),
      totalRows,
      validRows,
      selectedRows,
      importedRows,
      errorRows,
      validRowCoverage,
      importYield,
      errorRate,
      fieldCoverage,
    }
  }
}

function importEntries(metrics: JsonRecord | null | undefined): JsonRecord[] {
  if (!metrics) {
    return []
  }

  return [
    ...arrayField(metrics.imports),
    ...arrayField(metrics.genericPrecatorioImports),
    ...arrayField(metrics.tjrjAnnualMapImports),
  ]
    .map(recordField)
    .filter((item) => Object.keys(item).length > 0)
}

function fieldCoveragesFrom(extraction: JsonRecord): FieldCoverageItem[] {
  const completeness = recordField(extraction.completeness)

  if (Object.keys(completeness).length === 0) {
    return []
  }

  return [
    {
      cnj: nullableNumber(completeness.cnjCoverage),
      value: nullableNumber(completeness.valueCoverage),
      year: nullableNumber(completeness.yearCoverage),
      debtor: nullableNumber(completeness.debtorCoverage),
    },
  ]
}

function summarizeFieldCoverage(items: FieldCoverageItem[]) {
  const summary = {
    cnj: average(items.map((item) => item.cnj)),
    value: average(items.map((item) => item.value)),
    year: average(items.map((item) => item.year)),
    debtor: average(items.map((item) => item.debtor)),
  }
  const averageCoverage = average([summary.cnj, summary.value, summary.year, summary.debtor])

  return {
    ...summary,
    average: averageCoverage,
  }
}

function average(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === 'number')

  if (numbers.length === 0) {
    return null
  }

  return round4(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0
  }

  return round4(numerator / denominator)
}

function gradeFor(score: number): SourceDataQualitySummary['grade'] {
  if (score >= 0.85) {
    return 'A'
  }

  if (score >= 0.7) {
    return 'B'
  }

  if (score >= 0.5) {
    return 'C'
  }

  return 'D'
}

function recordField(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function numberField(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function nullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round4(value: number) {
  return Number(value.toFixed(4))
}

export default new SourceDataQualityService()
