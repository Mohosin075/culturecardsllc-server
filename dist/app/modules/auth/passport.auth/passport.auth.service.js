"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassportAuthServices = void 0;
const user_1 = require("../../../../enum/user");
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../../errors/ApiError"));
const user_model_1 = require("../../user/user.model");
const auth_helper_1 = require("../auth.helper");
const common_1 = require("../common");
const handleGoogleLogin = async (payload) => {
    const { emails, photos, displayName, id } = payload.profile;
    const email = emails[0].value.toLowerCase().trim();
    const isUserExist = await user_model_1.User.findOne({
        email,
        status: { $in: [user_1.USER_STATUS.ACTIVE] },
    });
    if (isUserExist) {
        //return only the token
        const tokens = auth_helper_1.AuthHelper.createToken(isUserExist._id, isUserExist.activeRole, isUserExist.name, isUserExist.email);
        return (0, common_1.authResponse)(http_status_codes_1.StatusCodes.OK, `Welcome ${isUserExist.name} to our platform.`, isUserExist.activeRole, tokens.accessToken, tokens.refreshToken);
    }
    const session = await user_model_1.User.startSession();
    session.startTransaction();
    const userData = {
        email: emails[0].value,
        profile: photos[0].value,
        name: displayName,
        verified: true,
        // password: id,
        status: user_1.USER_STATUS.ACTIVE,
        appId: id,
        roles: [user_1.USER_ROLES.USER],
        activeRole: user_1.USER_ROLES.USER,
    };
    try {
        const user = await user_model_1.User.create([userData], { session });
        if (!user) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
        }
        //create token
        const tokens = auth_helper_1.AuthHelper.createToken(user[0]._id, user[0].activeRole, user[0].name, user[0].email);
        await session.commitTransaction();
        await session.endSession();
        return (0, common_1.authResponse)(http_status_codes_1.StatusCodes.OK, `Welcome ${user[0].name} to our platform.`, user[0].activeRole, tokens.accessToken, tokens.refreshToken);
    }
    catch (error) {
        await session.abortTransaction(session);
        session.endSession();
        throw error;
    }
    finally {
        await session.endSession();
    }
};
exports.PassportAuthServices = {
    handleGoogleLogin,
};
