import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from './models.js';

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
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';
    const decoded = jwt.verify(token, secret);

    // Database-backed or in-memory server-side session invalidation and role check
    let userRole = decoded.role || 'researcher';
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(decoded.id).select('tokenVersion status role').lean();
      if (!user || user.status === 'deleted') {
        res.clearCookie('rp_token');
        res.clearCookie('researchproof_session');
        res.clearCookie('rp_session');
        return res.status(401).json({ error: 'User account not found or has been deleted.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
      }
      if (decoded.tokenVersion && user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
        res.clearCookie('rp_token');
        res.clearCookie('researchproof_session');
        res.clearCookie('rp_session');
        return res.status(401).json({ error: 'Session has been invalidated. Please sign in again.' });
      }
      if (user.role) userRole = user.role;
    } else if (req.app?.locals?.memUsers) {
      const user = req.app.locals.memUsers.get(decoded.email) ||
        [...req.app.locals.memUsers.values()].find(u => u._id === decoded.id || u.id === decoded.id);
      if (!user || user.status === 'deleted') {
        res.clearCookie('rp_token');
        res.clearCookie('researchproof_session');
        res.clearCookie('rp_session');
        return res.status(401).json({ error: 'User account not found or has been deleted.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
      }
      if (decoded.tokenVersion && user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
        res.clearCookie('rp_token');
        res.clearCookie('researchproof_session');
        res.clearCookie('rp_session');
        return res.status(401).json({ error: 'Session has been invalidated. Please sign in again.' });
      }
      if (user.role) userRole = user.role;
    }


    req.user = { ...decoded, role: userRole };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
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

