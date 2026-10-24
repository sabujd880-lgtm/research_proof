import mongoose from 'mongoose';
import { UsageEvent, DailyUsageAggregate, User, Document, Project, Revision, IntegrityReport, AuditEvent } from './models.js';

// In-Memory analytics store fallback for local dev / tests when MongoDB is disconnected
const memUsageEvents = [];
const memDailyAggregates = new Map();

export function getMemAnalytics() {
  return { memUsageEvents, memDailyAggregates };
}

function getTodayUtc() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Record a discrete platform usage event and increment daily aggregate counters
 */
export async function recordUsageEvent({
  eventType,
  feature,
  userId = null,
  durationMs = 0,
  success = true,
  errorCategory = null,
  provider = null,
  tokenCount = 0,
  requestId = '',
  metadata = {}
}) {
  const isDbConnected = mongoose.connection.readyState === 1;
  const today = getTodayUtc();

  if (isDbConnected) {
    try {
      // 1. Write discrete event with TTL
      await UsageEvent.create({
        eventType,
        feature,
        userId: userId ? new mongoose.Types.ObjectId(userId) : null,
        durationMs,
        success,
        errorCategory,
        provider,
        tokenCount,
        requestId,
        metadata
      });

      // 2. Increment fast daily aggregate
      await DailyUsageAggregate.findOneAndUpdate(
        { date: today, feature },
        {
          $inc: {
            requestCount: 1,
            successCount: success ? 1 : 0,
            failureCount: success ? 0 : 1
          }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn('Analytics event logging warning:', err.message);
    }
  } else {
    // In-memory fallback
    const event = {
      _id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      feature,
      userId: userId ? String(userId) : null,
      durationMs,
      success,
      errorCategory,
      provider,
      tokenCount,
      requestId,
      metadata,
      timestamp: new Date()
    };
    memUsageEvents.unshift(event);
    if (memUsageEvents.length > 500) memUsageEvents.pop();

    const aggKey = `${today}_${feature}`;
    const curr = memDailyAggregates.get(aggKey) || { date: today, feature, requestCount: 0, successCount: 0, failureCount: 0 };
    curr.requestCount += 1;
    if (success) curr.successCount += 1;
    else curr.failureCount += 1;
    memDailyAggregates.set(aggKey, curr);
  }
}

/**
 * Get aggregated analytics overview
 */
export async function getAnalyticsOverview(app) {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    const totalUsers = await User.countDocuments({ status: { $ne: 'deleted' } });
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau, newToday, activeUsers, suspendedUsers] = await Promise.all([
      User.countDocuments({ lastActiveAt: { $gte: oneDayAgo }, status: 'active' }),
      User.countDocuments({ lastActiveAt: { $gte: sevenDaysAgo }, status: 'active' }),
      User.countDocuments({ lastActiveAt: { $gte: thirtyDaysAgo }, status: 'active' }),
      User.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' })
    ]);

    const totalProjects = await Project.countDocuments();
    const totalDocuments = await Document.countDocuments();
    const totalRevisions = await Revision.countDocuments();
    const totalReports = await IntegrityReport.countDocuments();

    const recentEvents = await UsageEvent.find().sort({ timestamp: -1 }).limit(100).lean();
    const totalRequests = recentEvents.length;
    const failedRequests = recentEvents.filter(e => !e.success).length;

    return {
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, newToday, dau, wau, mau },
      content: { projects: totalProjects, documents: totalDocuments, revisions: totalRevisions, integrityReports: totalReports },
      traffic: { totalRequests, failedRequests, successRate: totalRequests ? Math.round(((totalRequests - failedRequests) / totalRequests) * 100) : 100 }
    };
  } else {
    // In-memory fallback calculation
    const users = app.locals.memUsers ? [...app.locals.memUsers.values()] : [];
    const activeUsers = users.filter(u => u.status !== 'suspended' && u.status !== 'deleted');
    const suspendedUsers = users.filter(u => u.status === 'suspended');

    const totalProjects = app.locals.memProjects ? app.locals.memProjects.size : 0;
    const totalDocuments = app.locals.memDocuments ? app.locals.memDocuments.size : 0;
    const totalRevisions = app.locals.memRevisions ? app.locals.memRevisions.size : 0;
    const totalReports = app.locals.memReports ? app.locals.memReports.size : 0;

    const totalRequests = memUsageEvents.length;
    const failedRequests = memUsageEvents.filter(e => !e.success).length;

    return {
      users: {
        total: users.length,
        active: activeUsers.length,
        suspended: suspendedUsers.length,
        newToday: users.length,
        dau: activeUsers.length,
        wau: activeUsers.length,
        mau: activeUsers.length
      },
      content: {
        projects: totalProjects,
        documents: totalDocuments,
        revisions: totalRevisions,
        integrityReports: totalReports
      },
      traffic: {
        totalRequests,
        failedRequests,
        successRate: totalRequests ? Math.round(((totalRequests - failedRequests) / totalRequests) * 100) : 100
      }
    };
  }
}

/**
 * Get Feature Usage distribution
 */
export async function getFeatureUsageBreakdown() {
  const isDbConnected = mongoose.connection.readyState === 1;
  if (isDbConnected) {
    const stats = await UsageEvent.aggregate([
      { $group: { _id: '$feature', totalCount: { $sum: 1 }, successCount: { $sum: { $cond: ['$success', 1, 0] } } } },
      { $sort: { totalCount: -1 } }
    ]);
    return stats.map(s => ({ feature: s._id, count: s.totalCount, successCount: s.successCount }));
  } else {
    const counts = {};
    for (const evt of memUsageEvents) {
      counts[evt.feature] = (counts[evt.feature] || 0) + 1;
    }
    return Object.entries(counts).map(([feature, count]) => ({ feature, count, successCount: count }));
  }
}

/**
 * Get Error Trends
 */
export async function getErrorTrends() {
  const isDbConnected = mongoose.connection.readyState === 1;
  if (isDbConnected) {
    const errors = await UsageEvent.find({ success: false })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('feature eventType errorCategory timestamp durationMs')
      .lean();
    return errors;
  } else {
    return memUsageEvents.filter(e => !e.success).slice(0, 50);
  }
}
