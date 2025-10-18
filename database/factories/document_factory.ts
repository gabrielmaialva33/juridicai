import factory from '@adonisjs/lucid/factories'
import { FactoryContextContract } from '@adonisjs/lucid/types/factory'
import Document from '#models/document'
import crypto from 'node:crypto'

/**
 * Generate a fake file hash (SHA256)
 */
function generateFileHash(): string {
  return crypto.randomBytes(32).toString('hex')
}

export const DocumentFactory = factory
  .define(Document, async ({ faker }: FactoryContextContract) => {
    const documentTypes = [
      { type: 'petition', ext: 'pdf', mime: 'application/pdf' },
      { type: 'contract', ext: 'pdf', mime: 'application/pdf' },
      { type: 'evidence', ext: 'pdf', mime: 'application/pdf' },
      { type: 'judgment', ext: 'pdf', mime: 'application/pdf' },
      { type: 'appeal', ext: 'pdf', mime: 'application/pdf' },
      { type: 'power_of_attorney', ext: 'pdf', mime: 'application/pdf' },
      { type: 'agreement', ext: 'pdf', mime: 'application/pdf' },
      {
        type: 'report',
        ext: 'docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { type: 'other', ext: 'pdf', mime: 'application/pdf' },
    ]

    const docType = faker.helpers.arrayElement(documentTypes)
    const fileName = `${faker.system.fileName({ extensionCount: 0 })}.${docType.ext}`
    const fileSize = faker.number.int({ min: 50_000, max: 5_000_000 }) // 50KB to 5MB

    return {
      title: faker.helpers.arrayElement([
        'Petição Inicial',
        'Contestação',
        'Contrato de Prestação de Serviços',
        'Certidão de Nascimento',
        'Procuração',
        'Sentença',
        'Acórdão',
        'Laudo Pericial',
        'Recibo de Pagamento',
      ]),
      description: faker.helpers.arrayElement([faker.lorem.sentence(), null]),
      document_type: docType.type,
      file_path: `uploads/documents/${faker.string.uuid()}/${fileName}`,
      file_hash: generateFileHash(),
      file_size: fileSize,
      mime_type: docType.mime,
      original_filename: fileName,
      storage_provider: faker.helpers.arrayElement(['local', 's3', 'gcs'] as const),
      ocr_text: faker.helpers.arrayElement([faker.lorem.paragraphs(3), null]),
      is_ocr_processed: faker.datatype.boolean({ probability: 0.6 }), // 60% already processed
      is_signed: faker.datatype.boolean({ probability: 0.3 }), // 30% digitally signed
      signature_data: null,
      access_level: faker.helpers.arrayElement(['tenant', 'case_team', 'owner_only'] as const),
      tags: faker.helpers.arrayElements(['importante', 'urgente', 'confidencial', 'publico'], {
        min: 0,
        max: 2,
      }),
      version: 1,
      parent_document_id: null,
    }
  })
  .state('petition', (document) => {
    document.document_type = 'petition'
    document.title = 'Petição Inicial'
    document.is_signed = true
    document.access_level = 'case_team'
  })
  .state('contract', (document) => {
    document.document_type = 'contract'
    document.title = 'Contrato'
    document.is_signed = true
    document.access_level = 'owner_only'
  })
  .state('evidence', (document) => {
    document.document_type = 'evidence'
    document.title = 'Documento Probatório'
    document.tags = ['importante', 'prova']
  })
  .state('signed', (document, ctx) => {
    document.is_signed = true
    document.signature_data = {
      signed_at: ctx.faker.date.recent({ days: 10 }).toISOString(),
      signer_name: ctx.faker.person.fullName(),
      signature_method: 'digital_certificate',
      certificate_serial: ctx.faker.string.alphanumeric(16).toUpperCase(),
    }
  })
  .state('with_ocr', (document, ctx) => {
    document.is_ocr_processed = true
    document.ocr_text = ctx.faker.lorem.paragraphs(5)
  })
  .state('confidential', (document) => {
    document.access_level = 'owner_only'
    document.tags = ['confidencial', 'restrito']
  })
  .state('versioned', (document, ctx) => {
    document.version = ctx.faker.number.int({ min: 2, max: 5 })
  })
  .build()
