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

    // Database-backed or in-memory server-side session invalidation check
    if (decoded.tokenVersion) {
      if (mongoose.connection.readyState === 1) {
        const user = await User.findById(decoded.id).select('tokenVersion status').lean();
        if (!user) {
          return res.status(401).json({ error: 'User account not found.' });
        }
        if (user.status === 'suspended') {
          return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
        }
        if (user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
          return res.status(401).json({ error: 'Session has been invalidated. Please sign in again.' });
        }
      } else if (req.app?.locals?.memUsers) {
        const user = req.app.locals.memUsers.get(decoded.email) ||
          [...req.app.locals.memUsers.values()].find(u => u._id === decoded.id || u.id === decoded.id);
        if (user) {
          if (user.status === 'suspended') {
            return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
          }
          if (user.tokenVersion && decoded.tokenVersion < user.tokenVersion) {
            return res.status(401).json({ error: 'Session has been invalidated. Please sign in again.' });
          }
        }
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}
