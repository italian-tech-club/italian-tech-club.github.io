// Partner catalog + member benefits. Single source of truth: imported by the
// frontend (public partner pages, member perk codes) and by the partners API
// (claims and partner-side verification), so a benefit id can never drift
// between them.
//
// Adding a partner = add an entry here, drop the logo in public/images/partners,
// commit. Nothing else to wire up.
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
];

export const activeBenefits = (partner) => partner.benefits.filter((benefit) => benefit.active);

// Partners worth listing publicly: at least one live perk to offer.
export const listedPartners = () => PARTNERS.filter((partner) => activeBenefits(partner).length > 0);

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
