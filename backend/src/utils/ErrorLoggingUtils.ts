/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Comprehensive error logging utility with automatic service/method detection
 * @note : Single class approach for all error logging needs
 **/

import { logger } from "./LogglyClient";
import { Request } from "express";
import { UserServiceException } from "../domain/error/AppException";
import { HttpError } from "routing-controllers";

export interface ErrorLoggerOptions {
    includeArgs?: boolean;
}

export class ErrorLoggingUtils {
    /**
     * Smart error logging with automatic request detection and context extraction
     * @param error - The error object
     * @param serviceName - Name of the service (auto-detected by decorator)
     * @param methodName - Name of the method (auto-detected by decorator)
     * @param context - Flexible context: Request object, or object containing Request, or any additional context (passed through as-is)
     */
    public static logError(error: any, serviceName: string, methodName: string, context?: Request | Record<string, any>): void {
        try {
            const validationInfo = error instanceof HttpError ? {
                validationMessage: error.message,
                validationName: error.name
            } : {};
            
            const { request, extractedContext } = this.smartExtractContext(context);
            
            const logMessage: Record<string, any> = {
                errorMessage: `[${serviceName}.${methodName}] failed : `,
                error: error?.message || error?.ERROR_MSG || (error && typeof error === 'object' ? JSON.stringify(error) : String(error)),
                errorCode: error?.httpCode || error?.statusCode || 500,
                ...validationInfo,
                response: error?.response?.data,
                stackTrace: error?.stack ? error.stack : undefined,
                ...extractedContext,
                service: serviceName,
                method: methodName,
            };
            
            if (request) {
                logMessage.requestBody = request.body;
                logMessage.queryParams = request.query;
                logMessage.pathParams = request.params;
                logMessage.headers = this.sanitizeData(structuredClone(request.headers));
                logMessage.path = request.path;
            }
            
            logger.error(logMessage);
        } catch (e: any) {
            logger.error(`[ErrorLoggingUtils.logError] failed to log error :: error occurred in [${serviceName}.${methodName}]: ${e.message} and ${e}`);
        }
    }

    /**
     * Create a UserServiceException with validation context
     * @param httpCode - HTTP status code
     * @param message - Error message
     * @param validationName - Name of the validation that failed
     * @returns UserServiceException with validation context
     */
    public static createValidationError(httpCode: number, message: string, validationName: string): UserServiceException {
        return new UserServiceException(httpCode, message, validationName);
    }

    /**
     * Decorator for automatic error logging
     */
    public static ErrorLogger(options: ErrorLoggerOptions = {}) {
        return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
            const originalMethod = descriptor.value;
            const { includeArgs = false } = options;

            descriptor.value = async function (...args: any[]) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    const serviceName = target?.constructor?.name || "AnonymousService";
                    const methodName = propertyName;
                    
                    const contextFromArgs: Record<string, any> = {};
                    if (includeArgs) {
                        contextFromArgs.methodArgs = args;
                    }
                    
                    ErrorLoggingUtils.logError(error, serviceName, methodName, contextFromArgs);

                    throw error; // Re-throw to maintain existing flow
                }
            };

            return descriptor;
        };
    }

    /**
     * Smart context extraction - handles request objects at any level
     * @private
     */
    private static smartExtractContext(context?: Request | Record<string, any>): { request?: Request | undefined, extractedContext: Record<string, any> } {
        let request: Request | undefined;
        let extractedContext: Record<string, any> = {};
        try {
            if (!context) {
                return { request, extractedContext };
            }
            
            if (this.isExpressRequest(context)) {
                request = context as Request;
            } else {
                const contextObj = { ...context as Record<string, any> };
                Object.keys(contextObj).forEach(key => {
                    if (this.isExpressRequest(contextObj[key])) {
                        if (!request) {
                            request = contextObj[key] as Request;
                        }
                        delete contextObj[key];
                    }
                });
                
                extractedContext = contextObj;
            }
        } catch (e: any) {
            logger.error(`[ErrorLoggingUtils.smartExtractContext] failed to extract context :: error: ${e.message} and ${e}`);
        }
        return { request, extractedContext };
    }

    /**
     * Check if object is an Express Request
     * @private
     */
    private static isExpressRequest(obj: any): boolean {
        return obj && typeof obj === 'object' && 
               (obj.body !== undefined || obj.query !== undefined || obj.params !== undefined) &&
               typeof obj.method === 'string';
    }

    /**
     * Sanitize sensitive headers only (no recursive processing)
     * @public
     */
    public static sanitizeData(data: any, excludeFields: string[] = []): any {
        if (!data || typeof data !== 'object') return data;
        
        const sanitized = { ...data };
        
        const defaultSensitiveFields = [
            'token', 'authorization', 'bearer', 'api-token',
            'api_gateway_route', 'content-type', 'connection', 'cookie',
            'uroute', 'x-app-policy', 'accept', 'anonce', 'password'
        ];
        
        const safeExcludeFields = Array.isArray(excludeFields) ? excludeFields : [];
        const allSensitiveFields = [...new Set([...defaultSensitiveFields, ...safeExcludeFields.map(f => f?.toLowerCase()).filter(Boolean)])];
        
        Object.keys(sanitized).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (allSensitiveFields.includes(lowerKey)) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
}
