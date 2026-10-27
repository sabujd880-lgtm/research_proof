import crypto from 'node:crypto';

// Cloudflare Turnstile official testing keys
// Always Passes: Sitekey: 1x00000000000000000000AA, Secret: 1x0000000000000000000000000000000AA
// Always Blocks: Sitekey: 2x00000000000000000000AB, Secret: 2x0000000000000000000000000000000AA
// Token Spent/Reused: Secret: 3x0000000000000000000000000000000AA
const DEFAULT_TESTING_SITE_KEY = '1x00000000000000000000AA';
const DEFAULT_TESTING_SECRET_KEY = '1x0000000000000000000000000000000AA';

export const getTurnstileSiteKey = () => {
  return process.env.TURNSTILE_SITE_KEY || DEFAULT_TESTING_SITE_KEY;
};

export const getTurnstileSecretKey = () => {
  return process.env.TURNSTILE_SECRET_KEY || DEFAULT_TESTING_SECRET_KEY;
};

// Replay protection cache (tokens cannot be used more than once)
const usedTokensCache = new Map(); // token -> timestamp
const FAILED_LOGIN_THRESHOLD = 3;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const failedLoginAttempts = new Map(); // key -> { count, lastAttempt }

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, ts] of usedTokensCache.entries()) {
    if (now - ts > 10 * 60 * 1000) usedTokensCache.delete(token);
  }
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) failedLoginAttempts.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * Verifies a Cloudflare Turnstile token via Cloudflare's Siteverify API
 */
export async function verifyTurnstileToken(token, clientIp = '') {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Missing security verification token. Please complete the verification challenge.',
      code: 'MISSING_TOKEN'
    };
  }

  const cleanToken = token.trim();

  // 1. Local Replay Protection check
  if (usedTokensCache.has(cleanToken)) {
    return {
      success: false,
      error: 'Security verification token has already been used. Please refresh the challenge.',
      code: 'REUSED_TOKEN'
    };
  }

  const secret = getTurnstileSecretKey();

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', cleanToken);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Turnstile verification service unreachable (${res.status}).`,
        code: 'SERVICE_UNAVAILABLE'
      };
    }

    const data = await res.json();

    if (!data.success) {
      const errorCodes = data['error-codes'] || [];
      if (errorCodes.includes('timeout-or-duplicate')) {
        return {
          success: false,
          error: 'Security challenge expired or already spent. Please complete a new challenge.',
          code: 'EXPIRED_OR_DUPLICATE'
        };
      }
      if (errorCodes.includes('invalid-input-response')) {
        return {
          success: false,
          error: 'Invalid security verification token.',
          code: 'INVALID_TOKEN'
        };
      }
      return {
        success: false,
        error: 'Security verification failed. Please try again.',
        code: 'VERIFICATION_FAILED',
        errorCodes
      };
    }

    // Mark token as used to prevent immediate replay
    usedTokensCache.set(cleanToken, Date.now());

    return {
      success: true,
      challengeTs: data.challenge_ts,
      hostname: data.hostname
    };
  } catch (err) {
    console.error('Turnstile verification error:', err.message);
    return {
      success: false,
      error: 'Failed to communicate with verification service.',
      code: 'NETWORK_ERROR'
    };
  }
}

// Pluggable verifier for test injection
let turnstileVerifierFn = verifyTurnstileToken;
export function setTurnstileVerifier(fn) {
  turnstileVerifierFn = fn || verifyTurnstileToken;
}
export async function executeTurnstileVerification(token, clientIp) {
  return turnstileVerifierFn(token, clientIp);
}

/**
 * Risk-Based Verification Management
 */
export function recordFailedLogin(identifier) {
  if (!identifier) return;
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const existing = failedLoginAttempts.get(key);

  if (!existing || now - existing.lastAttempt > ATTEMPT_WINDOW_MS) {
    failedLoginAttempts.set(key, { count: 1, lastAttempt: now });
  } else {
    existing.count += 1;
    existing.lastAttempt = now;
  }
}

export function resetFailedLogins(identifier) {
  if (!identifier) return;
  const key = identifier.toLowerCase().trim();
  failedLoginAttempts.delete(key);
}

export function isLoginVerificationRequired(identifier, clientIp = '') {
  const keys = [identifier?.toLowerCase()?.trim(), clientIp].filter(Boolean);
  const now = Date.now();

  for (const key of keys) {
    const record = failedLoginAttempts.get(key);
    if (record && now - record.lastAttempt <= ATTEMPT_WINDOW_MS) {
      if (record.count >= FAILED_LOGIN_THRESHOLD) {
        return true;
      }
    }
  }
  return false;
}

export function getFailedAttemptsCount(identifier) {
  if (!identifier) return 0;
  const record = failedLoginAttempts.get(identifier.toLowerCase().trim());
  return record ? record.count : 0;
}
