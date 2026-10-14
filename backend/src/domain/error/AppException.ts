/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Standard Application Exception for structured error handling and validation
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

export class AppException extends Error {
    public httpCode: number;
    public validationName: string;

    constructor(httpCode: number, message: string, validationName: string = "APPLICATION_ERROR") {
        super(message);
        this.name = "AppException";
        this.httpCode = httpCode;
        this.validationName = validationName;
        Object.setPrototypeOf(this, AppException.prototype);
    }
}

// Export alias for compatibility with company service exception conventions
export { AppException as UserServiceException };
