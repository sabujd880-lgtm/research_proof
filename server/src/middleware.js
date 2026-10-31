import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from './models.js';

export function clearAuthCookies(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const isProduction = process.env.NODE_ENV === 'production';
  const isCrossOrigin = Boolean(origin && !origin.includes('localhost') && !origin.includes('127.0.0.1'));
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'rp_session';

  const cookieNames = [sessionCookieName, 'rp_session', 'rp_token', 'researchproof_session'];

  for (const name of cookieNames) {
    res.clearCookie(name, { path: '/' });
    res.clearCookie(name, { path: '/', sameSite: 'lax', secure: isHttps || isProduction });
    if (isHttps || isProduction || isCrossOrigin) {
      res.clearCookie(name, { path: '/', sameSite: 'none', secure: true });
    }
  }
}

export async function requireAuth(req, res, next) {
  // Support custom session cookie, default rp_session cookie, and Bearer authorization header
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'rp_session';
  let token = req.cookies?.[sessionCookieName] || req.cookies?.rp_session || req.cookies?.researchproof_session || '';

  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      token = header.slice(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.', code: 'AUTH_REQUIRED' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';
    const decoded = jwt.verify(token, secret);

    // Database-backed or in-memory server-side session invalidation and role check
    let userRole = decoded.role || 'researcher';
    const isDbConnected = mongoose.connection.readyState === 1;
    const isDbConnecting = mongoose.connection.readyState === 2;

    if (isDbConnected) {
      let user = null;
      // 1. Look up by decoded.id if valid ObjectId
      if (decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
        user = await User.findById(decoded.id).select('tokenVersion status role email').lean();
      }
      // 2. If not found by ObjectId (e.g. Google ID was in decoded.id), look up by googleId
      if (!user && decoded.id) {
        user = await User.findOne({ googleId: decoded.id }).select('tokenVersion status role email').lean();
      }
      // 3. Fallback to lookup by email if available in decoded token
      if (!user && decoded.email) {
        user = await User.findOne({ email: decoded.email.toLowerCase() }).select('tokenVersion status role email').lean();
      }

      if (!user || user.status === 'deleted') {
        clearAuthCookies(req, res);
        return res.status(401).json({
          error: 'User account not found or has been deleted.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({
          error: 'Account is suspended. Please contact your administrator.',
          code: 'ACCOUNT_SUSPENDED'
        });
      }
      if (decoded.tokenVersion && user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
        clearAuthCookies(req, res);
        return res.status(401).json({
          error: 'Session has been invalidated. Please sign in again.',
          code: 'SESSION_INVALIDATED'
        });
      }
      if (user.role) userRole = user.role;
    } else if (isDbConnecting) {
      return res.status(503).json({
        error: 'Database service is initializing. Please retry in a moment.',
        code: 'SERVICE_INITIALIZING'
      });
    } else if (req.app?.locals?.memUsers) {
      const user = req.app.locals.memUsers.get(decoded.email) ||
        [...req.app.locals.memUsers.values()].find(u => u._id === decoded.id || u.id === decoded.id || u.googleId === decoded.id);
      if (!user || user.status === 'deleted') {
        clearAuthCookies(req, res);
        return res.status(401).json({
          error: 'User account not found or has been deleted.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({
          error: 'Account is suspended. Please contact your administrator.',
          code: 'ACCOUNT_SUSPENDED'
        });
      }
      if (decoded.tokenVersion && user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
        clearAuthCookies(req, res);
        return res.status(401).json({
          error: 'Session has been invalidated. Please sign in again.',
          code: 'SESSION_INVALIDATED'
        });
      }
      if (user.role) userRole = user.role;
    } else {
      return res.status(503).json({
        error: 'Authentication service temporarily unavailable.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    req.user = { ...decoded, role: userRole };
    next();
  } catch (err) {
    clearAuthCookies(req, res);
    return res.status(401).json({
      error: 'Session expired or invalid. Please sign in again.',
      code: 'SESSION_EXPIRED'
    });
  }
}

export async function requireAdmin(req, res, next) {
  // Ensure authentication ran
  if (!req.user) {
    return requireAuth(req, res, () => {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Administrative privileges required.' });
      }
      next();
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }

  next();
}

