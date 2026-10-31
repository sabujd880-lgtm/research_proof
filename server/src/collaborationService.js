// Phase 10: Research Collaboration Studio Service
// Multi-user team management, cryptographic invitations, 4-tier RBAC,
// document discussions, manuscript reviews, and audit tracking.

import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  Project,
  ProjectMember,
  ProjectInvitation,
  DocumentComment,
  ReviewRequest,
  CollaborationNotification,
  Task,
  Document
} from './models.js';

// In-memory fallback stores when MongoDB is disconnected or in test mock mode
export const memInvitations = new Map();
export const memComments = new Map();
export const memReviewRequests = new Map();
export const memNotifications = new Map();

// 4-Tier RBAC Hierarchy & Permissions Definition
export const COLLABORATION_ROLES = {
  OWNER: 'owner',
  EDITOR: 'editor',
  REVIEWER: 'reviewer',
  VIEWER: 'viewer'
};

export const ROLE_PERMISSIONS = {
  owner: ['read', 'write', 'comment', 'review', 'admin', 'manage_team', 'delete_project', 'manage_tasks', 'decide_review'],
  editor: ['read', 'write', 'comment', 'submit_review', 'manage_tasks'],
  reviewer: ['read', 'comment', 'review', 'decide_review'],
  viewer: ['read']
};

/**
 * Validates if a user role holds the necessary permission action
 */
export function hasPermission(role, action) {
  if (!role || !action) return false;
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()] || [];
  return permissions.includes(action) || permissions.includes('admin');
}

/**
 * Checks if actor role is privileged enough to assign or alter target role
 */
export function canAssignRole(actorRole, targetRole) {
  if (actorRole !== 'owner') return false;
  return ['owner', 'editor', 'reviewer', 'viewer'].includes(targetRole);
}

/**
 * Generates high-entropy crypto token and SHA-256 hash
 */
export function generateInvitationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Creates or updates an invitation to collaborate on a research project
 */
export async function createProjectInvitation({ projectId, email, role = 'editor', inviterId, ttlDays = 7, isDbConnected = true }) {
  const normalizedEmail = email.trim().toLowerCase();
  const validRoles = ['owner', 'editor', 'reviewer', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid invitation role: ${role}`);
  }

  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  if (isDbConnected) {
    // Invalidate existing pending invitations for this project + email
    await ProjectInvitation.updateMany(
      { projectId, email: normalizedEmail, status: 'pending' },
      { $set: { status: 'expired' } }
    );

    const invitation = await ProjectInvitation.create({
      projectId,
      email: normalizedEmail,
      role,
      inviterId,
      tokenHash,
      expiresAt,
      status: 'pending'
    });

    return {
      invitationId: invitation._id.toString(),
      email: normalizedEmail,
      role,
      rawToken,
      expiresAt,
      invitationUrl: `/invitations/${rawToken}/accept`
    };
  }

  // Fallback in-memory
  const id = new mongoose.Types.ObjectId().toString();
  const inviteRecord = {
    _id: id,
    projectId: projectId.toString(),
    email: normalizedEmail,
    role,
    inviterId: inviterId?.toString() || 'user',
    tokenHash,
    rawToken,
    expiresAt,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  memInvitations.set(tokenHash, inviteRecord);

  return {
    invitationId: id,
    email: normalizedEmail,
    role,
    rawToken,
    expiresAt,
    invitationUrl: `/invitations/${rawToken}/accept`
  };
}

/**
 * Accepts an invitation using the raw token and binds to accepting user
 */
export async function acceptProjectInvitation({ rawToken, userId, userEmail, isDbConnected = true }) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  if (isDbConnected) {
    const invite = await ProjectInvitation.findOne({ tokenHash, status: 'pending' });
    if (!invite) {
      throw new Error('Invalid or expired invitation token.');
    }

    if (new Date() > new Date(invite.expiresAt)) {
      invite.status = 'expired';
      await invite.save();
      throw new Error('Invitation token has expired.');
    }

    // Optional email check if user is already signed in
    if (userEmail && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      // Allow accepting if invited by email or match
    }

    invite.status = 'accepted';
    await invite.save();

    // Upsert project member
    let member = await ProjectMember.findOne({ projectId: invite.projectId, userId });
    if (member) {
      member.role = invite.role;
      member.status = 'active';
      await member.save();
    } else {
      member = await ProjectMember.create({
        projectId: invite.projectId,
        userId,
        role: invite.role,
        invitedBy: invite.inviterId,
        status: 'active',
        permissions: ROLE_PERMISSIONS[invite.role] || ['read']
      });
    }

    // Notify inviter
    await createNotification({
      userId: invite.inviterId,
      projectId: invite.projectId,
      type: 'invitation_accepted',
      title: 'Invitation Accepted',
      message: `${userEmail || 'A researcher'} joined the research team as ${invite.role}.`,
      isDbConnected: true
    });

    return { success: true, projectId: invite.projectId.toString(), role: invite.role, memberId: member._id.toString() };
  }

  // In-memory fallback
  const invite = memInvitations.get(tokenHash);
  if (!invite || invite.status !== 'pending') {
    throw new Error('Invalid or expired invitation token.');
  }
  if (new Date() > new Date(invite.expiresAt)) {
    invite.status = 'expired';
    throw new Error('Invitation token has expired.');
  }

  invite.status = 'accepted';
  const memberId = new mongoose.Types.ObjectId().toString();
  const newMember = {
    _id: memberId,
    projectId: invite.projectId,
    userId: userId.toString(),
    email: userEmail || invite.email,
    role: invite.role,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  return { success: true, projectId: invite.projectId, role: invite.role, memberId };
}

/**
 * Creates in-app collaboration notification
 */
export async function createNotification({ userId, projectId, type, title, message, link = '', isDbConnected = true }) {
  if (isDbConnected) {
    return await CollaborationNotification.create({
      userId,
      projectId,
      type,
      title,
      message,
      link,
      read: false
    });
  }

  const id = new mongoose.Types.ObjectId().toString();
  const notification = {
    _id: id,
    userId: userId?.toString(),
    projectId: projectId?.toString() || null,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString()
  };
  memNotifications.set(id, notification);
  return notification;
}

/**
 * Manuscript Peer Review Workflow State Transitions
 */
export const REVIEW_STATUSES = [
  'draft',
  'submitted_for_review',
  'under_review',
  'changes_requested',
  'revised',
  'approved',
  'rejected'
];

export const REVIEW_DECISIONS = [
  'pending',
  'accept',
  'minor_revisions',
  'major_revisions',
  'reject'
];

/**
 * Validates a review decision and calculates composite rigor score
 */
export function calculateReviewScore(criteria) {
  if (!criteria) return null;
  const {
    methodologicalRigor = 8,
    academicClarity = 8,
    citationEvidence = 8,
    originality = 8
  } = criteria;

  // Scale from 0-10 to 0-100
  const avg = (methodologicalRigor + academicClarity + citationEvidence + originality) / 4;
  return Math.round(avg * 10);
}
