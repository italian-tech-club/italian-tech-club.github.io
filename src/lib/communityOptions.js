// Shared vocabulary for member roles and "looking for" signals.
// Values must match the backend enums in server/models/CommunityProfile.js.

export const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'investor', label: 'Investor' },
  { value: 'innovator', label: 'Innovator' },
  { value: 'tech-enthusiast', label: 'Tech Enthusiast' },
  { value: 'researcher', label: 'Researcher' },
];

export const LOOKING_FOR_OPTIONS = [
  { value: 'cofounder', label: 'A Cofounder' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'job', label: 'New Opportunities' },
  { value: 'investors', label: 'Investors' },
  { value: 'beta-users', label: 'Beta Users' },
  { value: 'mentor', label: 'A Mentor' },
];

export const roleLabel = (value) => ROLE_OPTIONS.find((o) => o.value === value)?.label || value;
export const lookingForLabel = (value) => LOOKING_FOR_OPTIONS.find((o) => o.value === value)?.label || value;

// Phrase used in the anonymized teaser ("A Product Designer looking for a cofounder")
export const lookingForPhrase = (value) => ({
  cofounder: 'looking for a cofounder',
  hiring: 'hiring',
  job: 'open to new opportunities',
  investors: 'raising',
  'beta-users': 'looking for beta users',
  mentor: 'looking for a mentor',
}[value] || `looking for ${value}`);
