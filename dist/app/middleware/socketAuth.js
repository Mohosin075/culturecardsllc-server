"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketMiddleware = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const jwtHelper_1 = require("../../helpers/jwtHelper");
const colors_1 = __importDefault(require("colors"));
const config_1 = __importDefault(require("../../config"));
const handleZodError_1 = __importDefault(require("../../errors/handleZodError"));
const socketAuth = (...roles) => {
    return (socket, next) => {
        try {
            const token = socket.handshake.auth.token ||
                socket.handshake.query.token ||
                socket.handshake.headers.authorization;
            if (!token) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Authentication token is required to access this resource');
            }
            try {
                const jwtToken = extractToken(token);
                // Verify token
                const verifiedUser = jwtHelper_1.jwtHelper.verifyToken(jwtToken, config_1.default.jwt.jwt_secret);
                // Attach user to socket
                socket.user = {
                    userId: verifiedUser.userId || verifiedUser.authId,
                    authId: verifiedUser.authId,
                    name: verifiedUser.name,
                    email: verifiedUser.email,
                    role: verifiedUser.role,
                    ...verifiedUser,
                };
                // Guard user based on roles
                if (roles.length && !roles.includes(verifiedUser.role)) {
                    console.error(colors_1.default.red(`Socket authentication failed: User role ${verifiedUser.role} not authorized`));
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to access this socket event"));
                }
                console.log(colors_1.default.green(`Socket authenticated for user: ${verifiedUser.userId || verifiedUser.authId}`));
                next();
            }
            catch (error) {
                if (error instanceof Error && error.name === 'TokenExpiredError') {
                    throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Access Token has expired');
                }
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Invalid Access Token');
            }
        }
        catch (error) {
            if (error instanceof ApiError_1.default) {
                const apiError = error;
                const errorResponse = {
                    statusCode: apiError.statusCode,
                    error: getErrorName(apiError.statusCode),
                    message: apiError.message,
                };
                socket.emit('socket_error', errorResponse);
            }
            next(error);
        }
    };
};
const handleSocketRequest = (socket, ...roles) => {
    try {
        const token = socket.handshake.auth.token ||
            socket.handshake.query.token ||
            socket.handshake.headers.authorization;
        const jwtToken = extractToken(token);
        // Verify token
        const verifiedUser = jwtHelper_1.jwtHelper.verifyToken(jwtToken, config_1.default.jwt.jwt_secret);
        // Guard user based on roles
        if (roles.length && !roles.includes(verifiedUser.role)) {
            socket.emit('socket_error', createErrorResponse(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to access this socket event"));
            return null;
        }
        return {
            ...verifiedUser,
            userId: verifiedUser.userId || verifiedUser.authId,
        };
    }
    catch (error) {
        handleSocketError(socket, error);
        if (error instanceof Error && error.name === 'TokenExpiredError') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Access Token has expired');
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Invalid Access Token');
    }
};
function createErrorResponse(statusCode, message, errorMessages) {
    return {
        statusCode,
        error: getErrorName(statusCode),
        message,
        ...(errorMessages && { errorMessages }),
    };
}
function handleSocketError(socket, error) {
    if (error instanceof ApiError_1.default) {
        socket.emit('socket_error', createErrorResponse(error.statusCode, error.message));
    }
    else {
        socket.emit('socket_error', createErrorResponse(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error'));
    }
    console.error(colors_1.default.red(`Socket error: ${error.message}`), error);
}
function extractToken(token) {
    var _a;
    if (typeof token === 'string') {
        if (token.includes('{')) {
            try {
                const parsedToken = JSON.parse(token);
                return ((_a = parsedToken === null || parsedToken === void 0 ? void 0 : parsedToken.token) === null || _a === void 0 ? void 0 : _a.split(' ')[1]) || (parsedToken === null || parsedToken === void 0 ? void 0 : parsedToken.token) || token;
            }
            catch (_b) {
                // If parsing fails, continue with other methods
            }
        }
        if (token.startsWith('Bearer ')) {
            return token.split(' ')[1];
        }
    }
    return token;
}
function getErrorName(statusCode) {
    switch (statusCode) {
        case http_status_codes_1.StatusCodes.BAD_REQUEST:
            return 'Bad Request';
        case http_status_codes_1.StatusCodes.UNAUTHORIZED:
            return 'Unauthorized';
        case http_status_codes_1.StatusCodes.FORBIDDEN:
            return 'Forbidden';
        case http_status_codes_1.StatusCodes.NOT_FOUND:
            return 'Not Found';
        default:
            return 'Error';
    }
}
/**
 * Validate socket event data against schema
 */
const validateEventData = (socket, schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        const zodError = (0, handleZodError_1.default)(error);
        socket.emit('socket_error', {
            statusCode: zodError.statusCode,
            error: getErrorName(zodError.statusCode),
            message: zodError.message,
            errorMessages: zodError.errorMessages,
        });
        return null;
    }
};
exports.socketMiddleware = {
    socketAuth,
    validateEventData,
    handleSocketRequest,
};
