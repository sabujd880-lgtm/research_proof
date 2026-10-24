import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  // Support both secure HttpOnly cookie and Bearer authorization header
  let token = req.cookies?.rp_session || '';
  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}
