import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

interface AccessPayload {
  sub: string;
  role: string;
  orgId: string;
}

interface RefreshPayload {
  sub: string;
  tokenId: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload & jwt.JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshPayload & jwt.JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload & jwt.JwtPayload;
}
