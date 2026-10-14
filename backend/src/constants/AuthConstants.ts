/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Authentication, JWT, and Cookie Configuration Constants
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { _MINUTE_MS, _DAY_MS } from "./AppConstant";

export const BCRYPT_SALT_ROUNDS = 10;

export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY = "7d";

export const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 15 * _MINUTE_MS;
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * _DAY_MS;

export const COOKIE_NAMES = {
    ACCESS_TOKEN: "accessToken",
    REFRESH_TOKEN: "refreshToken"
} as const;
