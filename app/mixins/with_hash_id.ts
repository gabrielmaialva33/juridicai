import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import Sqids from 'sqids'
import env from '#start/env'

export const withHashId = <T extends NormalizeConstructor<typeof BaseModel>>(SuperClass: T) => {
  class WithHashId extends SuperClass {
    @column({
      isPrimary: true,
      serializeAs: env.get('NODE_ENV') === 'test' ? 'id' : null,
    })
    declare id: number

    @column({
      serializeAs: env.get('NODE_ENV') === 'test' ? null : 'id',
    })
    declare hashId: string

    @beforeCreate()
    static async generateHashId(model: any) {
      const sqids = new Sqids({
        minLength: 10,
      })

      const timestamp = DateTime.now().toMillis()
      const random = Math.floor(Math.random() * 1000000)
      model.hashId = sqids.encode([timestamp, random])
    }
  }

  return WithHashId
}
