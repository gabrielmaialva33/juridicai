import { createHash } from 'node:crypto'
import type { LucidModel, ModelAttributes } from '@adonisjs/lucid/types/model'

type ModelPayload<Model extends LucidModel> = Partial<ModelAttributes<InstanceType<Model>>>

export async function upsertModel<Model extends LucidModel>(
  model: Model,
  where: ModelPayload<Model>,
  payload: ModelPayload<Model>
): Promise<InstanceType<Model>> {
  const row = await model.query().where(where).first()

  if (row) {
    row.merge(payload)
    await row.save()
    return row as InstanceType<Model>
  }

  return model.create({ ...where, ...payload }) as Promise<InstanceType<Model>>
}

export function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function titleize(slug: string) {
  return slug
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
