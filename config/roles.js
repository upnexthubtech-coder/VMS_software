// config/roles.js
// Centralized mapping and allowed role list. Update this when database CHECK constraint values change.

// Allowed role tokens which must match the DB CHECK constraint values.
// IMPORTANT: Update this list to match the exact values enforced by your database.
const ALLOWED_ROLES = [
  'admin',
  'approver',
  'security',
    'employee',
    'hod',
    'manager',
    'lead',
    'supervisor',
    'director',
    'vp',
    'ceo',
    'cto',
    'USER'
];

/**
 * Map free-text designation to a canonical role token accepted by the DB.
 * Returns a default 'employee' if nothing matches the ALLOWED_ROLES.
 */
function mapDesignationToRole(designation) {
  // If we can't confidently map a free-text designation to one of the allowed
  // role tokens, return null so the caller can decide whether to auto-create
  // a user_profile. This avoids accidental insert of disallowed role values.
  if (!designation || typeof designation !== 'string') return null;
  const d = designation.toLowerCase();

  if (d.includes('admin')) return 'admin';
  if (d.includes('approver') || d.includes('approvals') || d.includes('approval') || d.includes('approv') || d.includes('hr')) return 'approver';
  if (d.includes('security') || d.includes('guard')) return 'security';
    if (d.includes('employee') || d.includes('engineer') || d.includes('developer') || d.includes('staff') || d.includes('intern')) return 'employee';
    if (d.includes('hod') || d.includes('head of department') || d.includes('head')) return 'hod';
    if (d.includes('manager')) return 'approver';
    if (d.includes('lead')) return 'approver';
    if (d.includes('supervisor')) return 'approver';
    if( d.includes('director')) return 'approver';
    if( d.includes('vp') || d.includes('vice president')) return 'approver';
    if( d.includes('ceo') || d.includes('chief executive officer')) return 'approver';
    if( d.includes('cto') || d.includes('chief technology officer')) return 'approver';
    if( d.includes('USER') || d.includes('USER')) return 'approver';

  // Head of Department / HOD / Head / Manager frequently act as approvers
  // Map 'hod', 'head', 'manager', 'lead' to approver so user_profile will be created
  // when the job title indicates approval/ownership responsibilities.
  if (d.includes('hod') || d.includes('head of') || d.includes('head') || d.includes('manager') || d.includes('lead')) return 'approver';

  // nothing matched — return null (no predictable role)
  return null;
}

module.exports = {
  ALLOWED_ROLES,
  mapDesignationToRole
};
