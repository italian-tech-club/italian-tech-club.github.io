// Partner catalog + member benefits. Single source of truth: imported by the
// frontend (public partner pages, member perk codes) and by the partners API
// (claims and partner-side verification), so a benefit id can never drift
// between them.
//
// Adding a partner = add an entry here, drop the logo in public/images/partners,
// commit. Nothing else to wire up.
//
// Two kinds of value a partner can bring, and a partner can carry either or both:
//   - `benefits`: member-only perks, each claimed as a personal code the partner
//     verifies against the roster.
//   - `access`: open doors that need no code — programming, people, events —
//     plus an optional `signup` link (a newsletter, a mailing list) that is how
//     members actually get in on them.
//
// Benefit ids are stored on every issued claim — never rename or reuse one, or
// codes already in members' hands stop resolving. Retire a benefit with
// `active: false` instead of deleting it, so old codes still verify.
//
// NOTHING SECRET GOES IN THIS FILE. It is imported by the frontend, so every
// value here ships in the client bundle and is readable by anyone. A partner's
// redemption key lives in env as PARTNER_VERIFY_KEY_<SLUG> — see
// server/routes/partners.js.

export const PARTNERS = [
  {
    slug: 'tih',
    name: 'Transatlantic Innovation Hub',
    shortName: 'TIH',
    tagline: 'powered by ATLAS',
    url: 'https://tihny.com',
    location: 'Manhattan, New York',
    // Only asset we have is the white-wordmark variant, so the logo always sits
    // on a dark tile — in both themes.
    logo: '/images/partners/transatlantic-innovation-hub-white.png',
    logoOnDark: true,
    partnerSince: 'August 2026',
    blurb:
      "Manhattan-based landing platform for Italian and European startups entering the US market — physical space, market-access programs, and a network of American investors, accelerators, and corporates.",
    benefits: [
      {
        id: 'tih-global-membership-2026',
        title: 'TIH Global Membership',
        discount: '50% off first year',
        eligibility: 'New memberships only',
        details:
          'Access to the TIH international network, member programming, preferred pricing, business community benefits, and a yearly allocation of coworking days across participating TIH locations.',
        // One-shot: the code burns on redemption, since the discount only applies
        // to a first-year signup.
        oneTime: true,
        active: true,
        howTo:
          'Send this code to the TIH team when you apply for membership. They check it against the ITC roster before applying the discount.',
      },
      {
        id: 'tih-desk-memberships-2026',
        title: 'Hot Desk & Dedicated Desk',
        discount: '20% off',
        eligibility: 'For as long as you stay an active ITC member',
        details:
          'Applies to Hot Desk and Dedicated Desk memberships at the Manhattan hub. Reusable, so the same code works when you renew or move up a tier.',
        oneTime: false,
        active: true,
        howTo:
          'Show this code at the front desk or quote it when booking. TIH checks it against the ITC roster each time.',
      },
    ],
  },
  {
    slug: 'iic-new-york',
    name: 'Istituto Italiano di Cultura di New York',
    shortName: 'IIC New York',
    tagline: 'Italian Cultural Institute of New York',
    url: 'https://iicnewyork.esteri.it/it/',
    location: '686 Park Avenue, New York',
    // White wordmark only, same as TIH — dark tile in both themes.
    logo: '/images/partners/istituto-italiano-di-cultura-white.png',
    logoOnDark: true,
    partnerSince: 'September 2026',
    blurb:
      "Italy's official cultural institute in New York. The Institute opens the community to opportunities beyond networking: culture, education, research, institutions, and professional development.",
    benefits: [],
    access: [
      {
        title: 'Talks on AI, science and innovation',
        details:
          'High-level events and talks on AI, science, innovation, design, business, and contemporary Italian culture, including series such as AI4Progress.',
      },
      {
        title: 'Italian experts in New York',
        details:
          'Opportunities to meet Italian experts, researchers, academics, entrepreneurs and institutional figures visiting or working in New York.',
      },
      {
        title: 'Culture, not just careers',
        details:
          'Exhibitions, screenings, lectures, performances, book presentations, and other events that make ITC more than purely a professional networking community.',
      },
    ],
    signup: {
      label: 'Subscribe to the IIC newsletter',
      shortLabel: 'Newsletter',
      url: 'https://lp.constantcontactpages.com/sl/t3C0lk4/iicnynewslettersignup',
      blurb: 'Every talk, screening and exhibition the Institute runs lands here first.',
    },
  },
];

export const activeBenefits = (partner) => partner.benefits.filter((benefit) => benefit.active);

const hasAccess = (partner) => (partner.access?.length ?? 0) > 0;

// Partners worth listing publicly: a live perk or open access to offer.
export const listedPartners = () =>
  PARTNERS.filter((partner) => activeBenefits(partner).length > 0 || hasAccess(partner));

// Partners with codes to claim — what the member perks area lists.
export const perkPartners = () => PARTNERS.filter((partner) => activeBenefits(partner).length > 0);

export const findPartner = (slug) => PARTNERS.find((partner) => partner.slug === slug) || null;

// Flat benefit lookup: benefit ids are globally unique across partners, which is
// what lets a claim reference a benefit by id alone.
export const findBenefit = (benefitId) => {
  for (const partner of PARTNERS) {
    const benefit = partner.benefits.find((b) => b.id === benefitId);
    if (benefit) return { partner, benefit };
  }
  return null;
};
