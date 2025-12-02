const { mapDesignationToRole } = require('../config/roles');

const samples = [
  'Senior Admin',
  'Approval Manager',
  'Security Guard',
  'Software Engineer',
  'HOD',
  'Head of Department',
  'Engineering Manager',
  null,
  'HR Approver'
];

console.log('Testing designation -> role mapping:');
for (const s of samples) {
  console.log(JSON.stringify(s), '=>', mapDesignationToRole(s));
}
