import vine from '@vinejs/vine'

/**
 * Validator for creating a new document
 */
export const createDocumentValidator = vine.compile(
  vine.object({
    // Optional relationships (at least one must be provided)
    case_id: vine.number().min(1).nullable().optional(),
    client_id: vine.number().min(1).nullable().optional(),

    // Required: Uploader (will be set automatically from auth.user)
    uploaded_by: vine.number().min(1).optional(),

    // Required: Title and document type
    title: vine.string().trim().minLength(3).maxLength(255),
    document_type: vine.enum([
      'petition',
      'contract',
      'evidence',
      'judgment',
      'appeal',
      'power_of_attorney',
      'agreement',
      'report',
      'other',
    ]),

    // Optional metadata
    description: vine.string().trim().maxLength(1000).nullable().optional(),

    // File information (these will be set by upload service)
    file_path: vine.string().trim().maxLength(500).optional(),
    file_hash: vine.string().trim().fixedLength(64).nullable().optional(), // SHA256
    file_size: vine.number().min(0).optional(), // bytes
    mime_type: vine.string().trim().maxLength(100).optional(),
    original_filename: vine.string().trim().maxLength(255).optional(),
    storage_provider: vine.enum(['local', 's3', 'gcs']).optional(),

    // OCR
    is_ocr_processed: vine.boolean().optional(),
    ocr_text: vine.string().trim().nullable().optional(),

    // Digital signature
    is_signed: vine.boolean().optional(),
    signature_data: vine
      .object({
        signer: vine.string().trim().maxLength(255).optional(),
        signed_at: vine.string().trim().optional(), // ISO datetime
        certificate: vine.string().trim().optional(),
        algorithm: vine.string().trim().maxLength(100).optional(),
      })
      .nullable()
      .optional(),

    // Access control
    access_level: vine.enum(['tenant', 'case_team', 'owner_only']).optional(),

    // Organization
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
    version: vine.number().min(1).optional(),
    parent_document_id: vine.number().min(1).nullable().optional(),
  })
)

/**
 * Validator for updating an existing document (metadata only)
 */
export const updateDocumentValidator = vine.compile(
  vine.object({
    // Relationships
    case_id: vine.number().min(1).nullable().optional(),
    client_id: vine.number().min(1).nullable().optional(),

    // Title and type
    title: vine.string().trim().minLength(3).maxLength(255).optional(),
    document_type: vine
      .enum([
        'petition',
        'contract',
        'evidence',
        'judgment',
        'appeal',
        'power_of_attorney',
        'agreement',
        'report',
        'other',
      ])
      .optional(),

    // Metadata
    description: vine.string().trim().maxLength(1000).nullable().optional(),

    // OCR
    ocr_text: vine.string().trim().nullable().optional(),

    // Digital signature
    is_signed: vine.boolean().optional(),
    signature_data: vine
      .object({
        signer: vine.string().trim().maxLength(255).optional(),
        signed_at: vine.string().trim().optional(),
        certificate: vine.string().trim().optional(),
        algorithm: vine.string().trim().maxLength(100).optional(),
      })
      .nullable()
      .optional(),

    // Access control
    access_level: vine.enum(['tenant', 'case_team', 'owner_only']).optional(),

    // Organization
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
  })
)

/**
 * Validator for document search/filter query parameters
 */
export const documentFilterValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    search: vine.string().trim().minLength(1).maxLength(255).optional(),
    case_id: vine.number().min(1).optional(),
    client_id: vine.number().min(1).optional(),
    document_type: vine
      .enum([
        'petition',
        'contract',
        'evidence',
        'judgment',
        'appeal',
        'power_of_attorney',
        'agreement',
        'report',
        'other',
      ])
      .optional(),
    uploaded_by: vine.number().min(1).optional(),
    is_signed: vine.boolean().optional(),
    is_ocr_processed: vine.boolean().optional(),
    access_level: vine.enum(['tenant', 'case_team', 'owner_only']).optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    uploaded_after: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    uploaded_before: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    with_case: vine.boolean().optional(),
    with_client: vine.boolean().optional(),
    with_uploader: vine.boolean().optional(),
  })
)

/**
 * Validator for file upload
 */
export const uploadDocumentValidator = vine.compile(
  vine.object({
    // File will be in multipart/form-data
    file: vine.file({
      size: '50mb', // Maximum file size
      extnames: [
        'pdf',
        'doc',
        'docx',
        'odt',
        'txt',
        'jpg',
        'jpeg',
        'png',
        'gif',
        'xls',
        'xlsx',
        'csv',
        'zip',
        'rar',
        '7z',
      ],
    }),

    // Metadata
    case_id: vine.number().min(1).nullable().optional(),
    client_id: vine.number().min(1).nullable().optional(),
    title: vine.string().trim().minLength(3).maxLength(255),
    document_type: vine.enum([
      'petition',
      'contract',
      'evidence',
      'judgment',
      'appeal',
      'power_of_attorney',
      'agreement',
      'report',
      'other',
    ]),
    description: vine.string().trim().maxLength(1000).nullable().optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).nullable().optional(),
    access_level: vine.enum(['tenant', 'case_team', 'owner_only']).optional(),

    // Processing options
    process_ocr: vine.boolean().optional(), // Whether to run OCR on upload
  })
)
