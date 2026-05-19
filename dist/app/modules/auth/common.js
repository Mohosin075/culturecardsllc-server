"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authResponse = exports.AuthCommonServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_1 = require("../../../enum/user");
const user_model_1 = require("../user/user.model");
const auth_helper_1 = require("./auth.helper");
const crypto_1 = require("../../../utils/crypto");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const emailHelper_1 = require("../../../helpers/emailHelper");
// import { emailQueue } from '../../../helpers/bull-mq-producer'
const handleLoginLogic = async (payload, isUserExist) => {
    const { authentication, verified, status, password } = isUserExist;
    const { restrictionLeftAt, wrongLoginAttempts } = authentication;
    if (!verified) {
        //send otp to user
        const otp = (0, crypto_1.generateOtp)();
        console.log({ otp });
        const otpExpiresIn = new Date(Date.now() + 5 * 60 * 1000);
        const authentication = {
            email: payload.email,
            oneTimeCode: otp,
            expiresAt: otpExpiresIn,
            latestRequestAt: new Date(),
            authType: 'createAccount',
        };
        await user_model_1.User.findByIdAndUpdate(isUserExist._id, {
            $set: {
                authentication,
            },
        });
        const otpTemplate = emailTemplate_1.emailTemplate.createAccount({
            name: isUserExist.name,
            email: isUserExist.email,
            otp,
        });
        emailHelper_1.emailHelper.sendEmail(otpTemplate);
        // emailQueue.add('emails', otpTemplate)
        return (0, exports.authResponse)(http_status_codes_1.StatusCodes.PROXY_AUTHENTICATION_REQUIRED, `An OTP has been sent to your ${payload.email}. Please verify.`);
    }
    if (status === user_1.USER_STATUS.DELETED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No account found with this email');
    }
    if (status === user_1.USER_STATUS.INACTIVE) {
        if (restrictionLeftAt && new Date() < restrictionLeftAt) {
            const remainingMinutes = Math.ceil((restrictionLeftAt.getTime() - Date.now()) / 60000);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.TOO_MANY_REQUESTS, `You are restricted to login for ${remainingMinutes} minutes`);
        }
    }
    const isPasswordMatched = await user_model_1.User.isPasswordMatched(payload.password, password);
    if (!isPasswordMatched) {
        isUserExist.authentication.wrongLoginAttempts = wrongLoginAttempts + 1;
        if (isUserExist.authentication.wrongLoginAttempts >= 5) {
            isUserExist.status = user_1.USER_STATUS.INACTIVE;
            isUserExist.authentication.restrictionLeftAt = new Date(Date.now() + 10 * 60 * 1000); // restriction for 10 minutes
        }
        await user_model_1.User.findByIdAndUpdate(isUserExist._id, {
            $set: {
                status: isUserExist.status,
                'authentication.restrictionLeftAt': isUserExist.authentication.restrictionLeftAt,
                'authentication.wrongLoginAttempts': isUserExist.authentication.wrongLoginAttempts,
            },
        });
        if (isUserExist.status === user_1.USER_STATUS.INACTIVE) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.TOO_MANY_REQUESTS, 'Too many incorrect password attempts. Your account has been restricted for 10 minutes.');
        }
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Incorrect password, please try again.');
    }
    await user_model_1.User.findByIdAndUpdate(isUserExist._id, {
        $set: {
            status: user_1.USER_STATUS.ACTIVE,
            deviceToken: payload.deviceToken,
            'authentication.restrictionLeftAt': null,
            'authentication.wrongLoginAttempts': 0,
        },
    });
    const rememberMe = payload.rememberMe || false;
    const tokens = auth_helper_1.AuthHelper.createToken(isUserExist._id, isUserExist.activeRole, isUserExist.name, isUserExist.email, payload.deviceToken, rememberMe);
    return (0, exports.authResponse)(http_status_codes_1.StatusCodes.OK, `Welcome back ${isUserExist.name}`, isUserExist.activeRole, tokens.accessToken, tokens.refreshToken);
};
exports.AuthCommonServices = {
    handleLoginLogic,
};
const authResponse = (status, message, role, accessToken, refreshToken, token) => {
    return {
        status,
        message,
        ...(role && { role }),
        ...(role && { activeRole: role }),
        ...(accessToken && { accessToken }),
        ...(refreshToken && { refreshToken }),
        ...(token && { token }),
    };
};
exports.authResponse = authResponse;
