import BaseException from '#exceptions/base_exception'

export default class ValidationException extends BaseException {
  static status = 422
  static code = 'E_VALIDATION_FAILURE'
}
