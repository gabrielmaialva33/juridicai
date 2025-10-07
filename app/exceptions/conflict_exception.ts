import BaseException from '#exceptions/base_exception'

export default class ConflictException extends BaseException {
  static status = 409
  static code = 'E_CONFLICT'
}
