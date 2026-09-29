// The Italian ecosystem of New York, as a graph. Powers /ecosystem only.
//
// Two things are encoded here and nowhere else:
//
//   1. ORGS — who exists. Every entry is a real organization with a public
//      footprint we could verify (site, press, or its own event listings).
//   2. EDGES — who works with whom. An edge is only written down when there is
//      a public trace of the two parties actually doing something together
//      (co-hosted event, formal partnership, institutional oversight, umbrella
//      membership). Adjacency in the same cluster is NOT an edge.
//
// `tie` is deliberately separate from EDGES: it is ITC NYC's own relationship
// with that organization, and it is the honest answer to "are we connected to
// these people or not". Default is `none` — an org gets promoted only when we
// have done something together. Do not upgrade a tie to describe an intention;
// `none` with a note is how we track white space, and the map is only useful if
// it keeps telling the truth about it.
//
// Positions are not stored: the layout is derived from cluster + tie at render
// time (src/lib/ecosystemLayout.js), so adding an org here is enough.

export const ITC_ID = 'itc-nyc';

// Colour carries ITC's tie, not the cluster — clusters are carried by position,
// which lets the palette stay at three hues and survive colour-blind checks
// (validated all-pairs, both themes). Never add a fourth hue here; add a ring
// style instead.
export const TIES = {
  partner: {
    id: 'partner',
    label: 'Partner',
    blurb: 'A standing agreement — member perks, or a formal collaboration.',
    light: '#2a78d6',
    dark: '#3987e5',
  },
  collaborator: {
    id: 'collaborator',
    label: 'Collaborator',
    blurb: 'We have built something together: a co-hosted event, a shared stage.',
    light: '#eb6834',
    dark: '#d95926',
  },
  network: {
    id: 'network',
    label: 'ITC network',
    blurb: 'Part of the Italian Tech Club itself.',
    light: '#1baf7a',
    dark: '#199e70',
  },
  none: {
    id: 'none',
    label: 'Not connected yet',
    blurb: 'Mapped, relevant, no shared work on the record.',
    light: '#94a3b8',
    dark: '#64748b',
  },
};

export const TIE_ORDER = ['network', 'partner', 'collaborator', 'none'];

export const CLUSTERS = [
  {
    id: 'itc',
    mapLabel: 'ITC',
    name: 'Italian Tech Club',
    blurb: 'Us, and the chapters we belong to.',
  },
  {
    id: 'bridges',
    mapLabel: 'Bridges',
    name: 'Innovation bridges',
    blurb:
      'Landing platforms, accelerators and recurring moments whose job is moving Italian companies into the US market.',
  },
  {
    id: 'institutions',
    mapLabel: 'Italian State',
    name: 'Italian State in New York',
    blurb:
      'The consular network and the public bodies that convene, endorse and fund. Slow to move, decisive when they do.',
  },
  {
    id: 'capital',
    mapLabel: 'Capital',
    name: 'Capital',
    blurb: 'Angels, funds and the associations that organize Italian private capital.',
  },
  {
    id: 'talent',
    mapLabel: 'Talent',
    name: 'Talent & mentorship',
    blurb:
      'Where Italians arrive from: student societies, alumni chapters, mentoring programs, fellowships.',
  },
  {
    id: 'research',
    mapLabel: 'Research',
    name: 'Research & academia',
    blurb: 'Scientists, scholars and the university centers that host the intellectual conversation.',
  },
  {
    id: 'business',
    mapLabel: 'Business & trade',
    name: 'Business & trade',
    blurb: 'Chambers, executive forums and industry bodies — the incumbent Italian business establishment.',
  },
  {
    id: 'heritage',
    mapLabel: 'Italian-American',
    name: 'Italian-American institutions',
    blurb:
      'A century of community organizations, professional guilds and foundations. Deep pockets, deep rooms, older demographics.',
  },
  {
    id: 'culture',
    mapLabel: 'Culture & media',
    name: 'Culture & media',
    blurb: 'Creative spaces and the outlets that decide what the Italian community in the US reads.',
  },
];

// One entry per organization. `since` is only filled in where a founding year is
// documented; blank beats a guess.
export const ORGS = [
  // ── Italian Tech Club ─────────────────────────────────────────────────────
  {
    id: ITC_ID,
    name: 'Italian Tech Club — New York Chapter',
    short: 'ITC NYC',
    cluster: 'itc',
    url: 'https://italiantechclubnyc.com',
    logo: '/images/itc/apple-mark.png',
    logoDark: '/images/itc/apple-mark-white.png',
    city: 'New York, NY',
    since: '2025',
    tie: 'network',
    blurb:
      'Community of Italian founders, engineers, investors and operators in New York. Monthly gatherings, member perks, co-founder matching, and Il Posto Fisso — the standing table anyone can show up to.',
    tags: ['community', 'founders', 'events'],
  },
  {
    id: 'itc-global',
    name: 'Italian Tech Club (global network)',
    short: 'ITC Global',
    cluster: 'itc',
    url: 'https://www.italiantechclub.com',
    logo: '/images/itc/tricolour-mark.png',
    city: 'Barcelona · Madrid · Valencia · Berlin · Paris · Amsterdam · London · San Francisco',
    tie: 'network',
    tieNote: 'NYC is one chapter of the network; the other cities are our sibling chapters.',
    blurb:
      'The network ITC NYC belongs to: Italian tech communities in eight other cities, sharing a format and a members base.',
    tags: ['network', 'chapters'],
  },

  // ── Innovation bridges ────────────────────────────────────────────────────
  {
    id: 'i3nyc',
    name: 'I³/NYC — Italian Innovators Initiative',
    short: 'I³/NYC',
    cluster: 'bridges',
    url: 'https://www.i3nyc.org',
    city: 'New York, NY',
    since: '2024',
    tie: 'collaborator',
    tieNote:
      'Executive Chair Gianluca Galletto was our guest for the December 2025 Tech Talk at 417 Fifth Avenue; I³ lists that evening among its own events, co-billed with NIAF YPN.',
    blurb:
      'Nonprofit connecting Italian startups and scaleups to New York capital, corporates and talent. Founded by Gianluca Galletto and Simone Tarantino, launched at the Consulate in December 2024, and the organizer of Italian Innovation Week.',
    tags: ['nonprofit', 'market entry', 'events'],
  },
  {
    id: 'tih',
    name: 'Transatlantic Innovation Hub',
    short: 'TIH',
    cluster: 'bridges',
    url: 'https://tihny.com',
    city: '417 Fifth Avenue, New York, NY',
    since: '2026',
    tie: 'partner',
    tieNote:
      'Member-perk partner since August 2026: 50% off the first year of TIH Global Membership, 20% off hot and dedicated desks. We also held our December 2025 Tech Talk in this space, when it still ran as Impact Hub New York.',
    logo: '/images/partners/transatlantic-innovation-hub-white.png',
    logoOnDark: true,
    blurb:
      'The first permanent Italian landing platform in Manhattan — space, incorporation and compliance support, lead generation and investor access. Promoted by ATLAS (Confindustria innovative services) with Simone Tarantino as Managing Director. Took over the 417 Fifth Avenue space that operated as Impact Hub New York.',
    tags: ['coworking', 'market entry', 'partner'],
  },
  {
    id: 'italian-innovation-week',
    name: 'Italian Innovation Week NYC',
    short: 'Innovation Week',
    cluster: 'bridges',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'The Innovation Corner puts 15–20 Italian companies in a New York room for a day. No ITC presence on the record.',
    blurb:
      "I³/NYC's flagship five-day program: a startup mission through corporate innovation labs, then a flagship Innovation Day with keynotes, panels and an Innovation Corner. Supported by the Consulate, the Italian Trade Agency, SMAU and CDP.",
    tags: ['event', 'startups'],
  },
  {
    id: 'ventureout',
    name: 'VentureOut',
    short: 'VentureOut',
    cluster: 'bridges',
    url: 'https://ventureoutny.com',
    city: 'New York, NY',
    since: '2012',
    tie: 'none',
    blurb:
      'NYC acceleration platform for international startups — 2,100+ founders from 28 countries since 2012, with a recurring Italy program that lands companies in the New York market.',
    tags: ['accelerator', 'market entry'],
  },
  {
    id: 'gener8tor',
    name: 'gener8tor',
    short: 'gener8tor',
    cluster: 'bridges',
    url: 'https://www.gener8tor.com',
    city: 'Milwaukee, WI · New York, NY',
    tie: 'none',
    blurb:
      "US accelerator that runs the New York cohort of the Italian Trade Agency's Global Startup Program — six weeks in NYC for ten Italian startups a year.",
    tags: ['accelerator'],
  },
  {
    id: 'innovit',
    name: 'INNOVIT — Italian Innovation and Culture Hub',
    short: 'INNOVIT',
    cluster: 'bridges',
    url: 'https://innovitsf.com',
    city: 'San Francisco, CA',
    since: '2022',
    tie: 'none',
    tieNote: 'The West Coast counterpart to what New York has been assembling privately. Nothing shared on the record.',
    blurb:
      "Italy's government-backed innovation hub in San Francisco — 11,200 sq ft of offices and event space promoted by the Ministry of Foreign Affairs and coordinated with the Consulate.",
    tags: ['government', 'hub'],
  },
  {
    id: 'mind-the-bridge',
    name: 'Mind the Bridge',
    short: 'Mind the Bridge',
    cluster: 'bridges',
    url: 'https://mindthebridge.com',
    city: 'San Francisco, CA · Milan',
    tie: 'none',
    blurb:
      'Scaleup advisory and open-innovation research outfit that has bridged Italy and Silicon Valley since the late 2000s, including the Scale Up Summit series.',
    tags: ['advisory', 'research'],
  },
  {
    id: 'ibii',
    name: 'Italian Business & Investment Initiative',
    short: 'IB&II',
    cluster: 'bridges',
    city: 'New York, NY',
    since: '2010',
    tie: 'none',
    blurb:
      'Founded by Fernando Napolitano to put Italian SMEs and startups in front of US investors. Ran the "Italy Meets the United States of America" summit in New York with Aspen Institute Italia, plus investment symposia in NYC and Silicon Valley.',
    tags: ['legacy', 'investment'],
  },
  {
    id: 'italian-tech-week',
    name: 'Italian Tech Week / Wave by Vento',
    short: 'Italian Tech Week',
    cluster: 'bridges',
    url: 'https://wavebyvento.com',
    city: 'OGR, Turin',
    tie: 'none',
    tieNote: "Where the Italian ecosystem gathers once a year. Being the New York room there is unclaimed.",
    blurb:
      "Italy's largest tech conference — 1,500+ startups and 1,500+ investors at OGR Torino, organized by Vento (Exor Ventures) with GEDI, rebranded Wave by Vento for 2026.",
    tags: ['conference', 'italy'],
  },
  {
    id: 'smau',
    name: 'SMAU',
    short: 'SMAU',
    cluster: 'bridges',
    url: 'https://www.smau.it',
    city: 'Milan',
    tie: 'none',
    blurb:
      "Italy's long-running innovation fair and roadshow, connecting regional ecosystems, corporates and startups. A recurring I³/NYC partner in Milan and on Innovation Week.",
    tags: ['fair', 'italy'],
  },

  // ── Italian State in New York ─────────────────────────────────────────────
  {
    id: 'consulate-ny',
    name: 'Consulate General of Italy in New York',
    short: 'Consulate',
    cluster: 'institutions',
    url: 'https://consnewyork.esteri.it',
    city: '690 Park Avenue, New York, NY',
    tie: 'none',
    tieNote:
      'The room every other organization in this map has been endorsed in or launched from. The single highest-leverage introduction on the board.',
    blurb:
      'The Italian State in New York: consular services for the community, and the convening power behind launches, patronages and endorsements across the whole ecosystem. Consul General Giuseppe Pastorelli since January 2026.',
    tags: ['government', 'convener'],
  },
  {
    id: 'iic-ny',
    name: 'Istituto Italiano di Cultura New York',
    short: 'IIC New York',
    cluster: 'institutions',
    url: 'https://iicnewyork.esteri.it',
    city: '686 Park Avenue, New York, NY',
    since: '1961',
    tie: 'partner',
    tieNote:
      'Partner since September 2026: opens the community to its talks (AI4Progress among them), visiting Italian experts and cultural programming.',
    logo: '/images/partners/istituto-italiano-di-cultura-white.png',
    logoOnDark: true,
    blurb:
      "Italy's official cultural institute in New York — language courses, a 30,000-volume library, film festivals and a hall that hosts the community's more institutional evenings.",
    tags: ['culture', 'government', 'venue', 'partner'],
  },
  {
    id: 'ita-ny',
    name: 'Italian Trade Agency — New York (ICE)',
    short: 'ITA · ICE',
    cluster: 'institutions',
    url: 'https://www.ice.it',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'Runs the Global Startup Program cohorts that arrive in New York every year — founders who land with no community waiting for them.',
    blurb:
      "Italy's trade promotion agency. The New York office runs the Global Startup Program, an FDI desk, and the trade-show machine behind Made in Italy showcases from Coterie to Italy on Madison.",
    tags: ['government', 'trade', 'startups'],
  },
  {
    id: 'enit-ny',
    name: 'ENIT — Italian National Tourist Board, New York',
    short: 'ENIT',
    cluster: 'institutions',
    url: 'https://www.italiantourism.com',
    city: '686 Park Avenue, New York, NY',
    since: '1919',
    tie: 'none',
    blurb:
      "Italy's national tourist board in North America, promoting travel to Italy through trade and media partners from its Park Avenue office.",
    tags: ['government', 'tourism'],
  },
  {
    id: 'embassy-dc',
    name: 'Embassy of Italy in Washington DC',
    short: 'Embassy of Italy',
    cluster: 'institutions',
    url: 'https://ambwashingtondc.esteri.it',
    city: 'Washington, DC',
    tie: 'none',
    blurb:
      'The diplomatic head of the network the Consulate, the Cultural Institute, ITA and ENIT all hang from — and the co-sponsor of national-scale Italy–US science and culture programs.',
    tags: ['government'],
  },
  {
    id: 'comites-ny',
    name: 'Comites New York',
    short: 'Comites NY',
    cluster: 'institutions',
    url: 'https://comitesny.org',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'Elected representation for exactly our demographic — recently arrived Italians. Reaches the community through the Consulate rather than through tech.',
    blurb:
      'The elected committee representing Italians resident in the New York consular district (NY, CT and much of northern New Jersey), bringing community needs to the Consulate and Italian institutions.',
    tags: ['elected', 'community'],
  },
  {
    id: 'iace',
    name: 'Italian American Committee on Education',
    short: 'IACE',
    cluster: 'institutions',
    url: 'https://www.iacelanguage.org',
    city: 'New York, NY',
    since: '1975',
    tie: 'none',
    blurb:
      'Runs Italian language education across NY, NJ and CT — tens of thousands of students, school grants and adult courses — financed by an Italian government grant under Consulate supervision.',
    tags: ['education', 'language'],
  },
  {
    id: 'scuola-italia',
    name: "La Scuola d'Italia Guglielmo Marconi",
    short: "Scuola d'Italia",
    cluster: 'institutions',
    url: 'https://www.lascuoladitalia.org',
    city: 'New York, NY',
    since: '1977',
    tie: 'none',
    tieNote:
      'Where Italian families in New York with school-age children converge. Parent body overlaps heavily with senior Italian professionals in the city.',
    blurb:
      'The only bilingual Italian–English preK–12 day school in North America, established by the Italian Ministry of Foreign Affairs.',
    tags: ['education', 'families'],
  },

  // ── Capital ───────────────────────────────────────────────────────────────
  {
    id: 'nova-angels',
    name: 'Nova Angels',
    short: 'Nova Angels',
    cluster: 'capital',
    url: 'https://www.novatalent.com/nova-angels',
    city: 'Global · Milan · New York',
    tie: 'none',
    tieNote: 'Angel club sitting on top of the Nova talent network — the closest capital source to our own member profile.',
    blurb:
      'Angel network attached to Nova, investing in founders drawn from the top of the Nova network and vetted against it, with the network itself as follow-on resource.',
    tags: ['angels', 'early stage'],
  },
  {
    id: 'alphaprime',
    name: 'AlphaPrime Ventures',
    short: 'AlphaPrime',
    cluster: 'capital',
    url: 'https://alphaprime.com',
    city: '540 Madison Avenue, New York, NY',
    since: '2013',
    tie: 'none',
    blurb:
      'New York venture firm investing in safety and security technology, led by Alessandro Piol — 30+ years in US venture, co-founder of Vedanta Capital and an I³/NYC board member.',
    tags: ['vc', 'new york'],
  },
  {
    id: 'aifi',
    name: 'AIFI — Italian Private Equity, Venture Capital and Private Debt Association',
    short: 'AIFI',
    cluster: 'capital',
    url: 'https://www.aifi.it',
    city: 'Milan',
    since: '1986',
    tie: 'none',
    blurb:
      'The trade association of Italian private capital, and the source of the market data everyone quotes. Sponsor of I³/NYC and a Mentors4u program partner.',
    tags: ['association', 'italy'],
  },
  {
    id: 'cdp-vc',
    name: 'CDP Venture Capital',
    short: 'CDP VC',
    cluster: 'capital',
    url: 'https://www.cdpventurecapital.it',
    city: 'Rome · Milan · Turin',
    tie: 'none',
    blurb:
      "Italy's national innovation fund manager — the anchor LP behind much of the Italian VC market, and a sponsor of Italian Innovation Week in New York.",
    tags: ['fund of funds', 'state-backed'],
  },
  {
    id: 'iag',
    name: 'Italian Angels for Growth',
    short: 'IAG',
    cluster: 'capital',
    url: 'https://www.italianangels.net',
    city: 'Milan',
    tie: 'none',
    blurb:
      "Italy's largest business angel network — 600+ angels, 7,000+ opportunities screened, 125+ deals — and a common first cheque for Italian founders who later move to the US.",
    tags: ['angels', 'italy'],
  },
  {
    id: 'club-investitori',
    name: 'Club degli Investitori',
    short: 'Club Investitori',
    cluster: 'capital',
    url: 'https://clubdeglinvestitori.it',
    city: 'Turin',
    tie: 'none',
    blurb:
      'Turin-based club of 450+ business angels backing Italian founders with capital, network and operating experience.',
    tags: ['angels', 'italy'],
  },
  {
    id: 'intesa-innovation',
    name: 'Intesa Sanpaolo Innovation Center',
    short: 'Intesa Innovation',
    cluster: 'capital',
    url: 'https://www.intesasanpaoloinnovationcenter.com',
    city: 'Turin · New York, NY',
    tie: 'none',
    tieNote:
      "Italian corporate capital with a standing New York scouting brief — and the bank most Italian companies here already bank with.",
    blurb:
      "Intesa Sanpaolo's innovation arm, with New York among its international nodes for technology scouting, startup support and corporate open innovation.",
    tags: ['corporate', 'bank'],
  },

  // ── Talent & mentorship ───────────────────────────────────────────────────
  {
    id: 'uis',
    name: 'United Italian Societies',
    short: 'UIS',
    cluster: 'talent',
    url: 'https://uniteditaliansocieties.com',
    city: 'Global · New York, NY',
    tie: 'collaborator',
    tieNote:
      'Co-hosted ITC x UIS: Meet & Eat at La Piadineria, February 2026 — networking and food for both communities.',
    blurb:
      'The largest network of Italian student societies abroad — 60+ partner universities including Columbia, Harvard and MIT, some 11,000 students — with mentorship programs and a US chapter that held its 2026 Italian Symposium in New York.',
    tags: ['students', 'network'],
  },
  {
    id: 'nova-mba',
    name: 'NOVA-MBA Association',
    short: 'NOVA-MBA',
    cluster: 'talent',
    url: 'https://nova-mba.com',
    city: 'United States · Italy',
    since: '2001',
    tie: 'none',
    tieNote:
      'Italian MBAs from top global schools — the operator and executive layer of the diaspora, adjacent to our founder-heavy base.',
    blurb:
      'US nonprofit uniting 3,000+ MBAs of Italian heritage from top global business schools, founded in 2001 by Ivy-League students with backing from prominent Italians abroad including Franco Modigliani.',
    tags: ['alumni', 'mba'],
  },
  {
    id: 'fondazione-nova',
    name: 'Fondazione NOVA',
    short: 'Fondazione NOVA',
    cluster: 'talent',
    url: 'https://www.fondazione-nova.org',
    city: 'Milan · United States',
    since: '2022',
    tie: 'none',
    blurb:
      'The pro-bono umbrella that brought NOVA-MBA and Mentors4u together, mobilizing 6,000+ selected mentees, alumni and executives around education and merit in Italy.',
    tags: ['foundation', 'umbrella'],
  },
  {
    id: 'mentors4u',
    name: 'Mentors4u',
    short: 'Mentors4u',
    cluster: 'talent',
    url: 'https://www.mentors4u.com',
    city: 'Milan · Global',
    since: '2014',
    tie: 'none',
    blurb:
      "Europe's largest free mentoring program, started by Italian Harvard Business School alumni: 1,000+ mentors matched one-to-one with Italian students heading into finance, consulting and startups.",
    tags: ['mentorship', 'students'],
  },
  {
    id: 'lead-the-future',
    name: 'Lead The Future',
    short: 'Lead The Future',
    cluster: 'talent',
    url: 'https://www.leadthefuture.tech',
    city: 'Global',
    tie: 'none',
    tieNote:
      'The STEM half of the diaspora talent pipeline — PhDs and engineers, exactly the profile our technical members hire.',
    blurb:
      'Mentorship nonprofit for Italian science and engineering talent, pairing students with mentors at NASA, ESA, MIT, ETH, Oxford, IBM and Google — free, and global.',
    tags: ['mentorship', 'stem'],
  },
  {
    id: 'nybf',
    name: 'New York Business Fellowship',
    short: 'NYBF',
    cluster: 'talent',
    url: 'https://newyorkbusinessfellowship.com',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'Every cohort spends a week inside the NYC business ecosystem — a recurring flow of Italian-founded talent through the city.',
    blurb:
      'Selective one-week immersion in the New York business ecosystem — mentor sessions, company visits at the likes of Google, BlackRock and the NYSE, and a case competition. Co-founded by Giovanni Gallina.',
    tags: ['fellowship', 'students'],
  },
  {
    id: 'nova-talent',
    name: 'Nova Talent',
    short: 'Nova',
    cluster: 'talent',
    url: 'https://www.novatalent.com',
    city: '30+ cities · Milan · Rome · New York',
    tie: 'none',
    tieNote:
      'Vetted membership, micro-communities and Nova Angels attached to it — the closest peer community to ours, on the same profile of member.',
    blurb:
      'Global top-talent network with vetted membership, micro-communities and city chapters across Europe and the US, including a strong Italian base in Milan and Rome.',
    tags: ['network', 'talent'],
  },
  {
    id: 'bocconi-alumni-ny',
    name: 'Bocconi Alumni Community — New York',
    short: 'Bocconi Alumni NY',
    cluster: 'talent',
    url: 'https://www.bocconialumni.it',
    city: 'New York, NY',
    tie: 'none',
    blurb:
      'The New York chapter of the Bocconi alumni community — historically one of its most active, and home to Friends of Bocconi, the university\'s US charity.',
    tags: ['alumni', 'university'],
  },
  {
    id: 'polimi-alumni-na',
    name: 'Alumni Politecnico di Milano North America',
    short: 'AlumniPolimi NA',
    cluster: 'talent',
    url: 'https://alumni.polimi.it',
    city: 'New York, NY · Boston · Miami · DC · SF · LA',
    since: '2014',
    tie: 'none',
    tieNote:
      'Founded in New York, 500+ engineers and designers across North America. The single densest pool of Italian technical alumni on this continent.',
    blurb:
      'The North American chapter of Politecnico di Milano alumni, founded in New York in 2014 with 500+ members across six US cities.',
    tags: ['alumni', 'engineering'],
  },
  {
    id: 'b4i',
    name: 'B4i — Bocconi for Innovation',
    short: 'B4i',
    cluster: 'talent',
    url: 'https://www.b4i.unibocconi.it',
    city: 'Milan',
    tie: 'none',
    blurb:
      "Bocconi's accelerator — 240+ startups through pre-acceleration and acceleration — which presented its cohort in New York with I³/NYC in October 2025.",
    tags: ['accelerator', 'university'],
  },
  {
    id: 'columbia-italian-society',
    name: 'The Italian Society at Columbia University',
    short: 'Columbia Italian',
    cluster: 'talent',
    url: 'https://www.instagram.com/cuitaliansociety/',
    city: 'Columbia University, New York, NY',
    tie: 'none',
    tieNote: 'Undergraduate feeder, walking distance from most of our members. A UIS partner society.',
    blurb:
      "Columbia's student club for all things Italian — social, cultural and career events for Italian and Italophile students on campus.",
    tags: ['students', 'campus'],
  },
  {
    id: 'nyu-italian-club',
    name: 'Italian Club at NYU',
    short: 'NYU Italian Club',
    cluster: 'talent',
    url: 'https://engage.nyu.edu/organization/italian-club-at-nyu',
    city: 'New York University, New York, NY',
    tie: 'none',
    blurb:
      'Student organization at NYU for Italian language, culture and community, alongside the Department of Italian Studies at Casa Italiana.',
    tags: ['students', 'campus'],
  },

  // ── Research & academia ───────────────────────────────────────────────────
  {
    id: 'issnaf',
    name: 'ISSNAF — Italian Scientists and Scholars in North America Foundation',
    short: 'ISSNAF',
    cluster: 'research',
    url: 'https://www.issnaf.org',
    city: 'North America · New York chapter',
    tie: 'none',
    tieNote:
      "The scientific diaspora's own institution: 3,000+ researchers, awards, fellowships and a New York chapter. Deep technical bench, no tech-community bridge.",
    blurb:
      'Foundation connecting the Italian intellectual diaspora in North America — 3,000+ scholars and technologists across every discipline, with chapters, young investigator awards and mentoring programs.',
    tags: ['research', 'network'],
  },
  {
    id: 'airicerca-ny',
    name: 'AIRIcerca New York Chapter',
    short: 'AIRIcerca NY',
    cluster: 'research',
    url: 'https://www.newyork.airicerca.org',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      "Italian researchers at MSK, Weill Cornell and Rockefeller, with a survival guide for new arrivals. The same landing problem we solve, one discipline over.",
    blurb:
      'The New York chapter of the international association of Italian researchers — free membership, events with Memorial Sloan Kettering, Weill Cornell and Rockefeller, under Consulate patronage.',
    tags: ['research', 'community'],
  },
  {
    id: 'casa-italiana',
    name: 'Casa Italiana Zerilli-Marimò at NYU',
    short: 'Casa Italiana NYU',
    cluster: 'research',
    url: 'https://www.casaitaliananyu.org',
    city: '24 West 12th Street, New York, NY',
    since: '1990',
    tie: 'none',
    blurb:
      "NYU's Italian cultural center and home of its Department of Italian Studies — a free public program of talks, books and film, run in concert with Columbia's Italian Academy, CUNY's Calandra Institute and Centro Primo Levi.",
    tags: ['university', 'culture', 'venue'],
  },
  {
    id: 'italian-academy',
    name: 'The Italian Academy for Advanced Studies in America',
    short: 'Italian Academy',
    cluster: 'research',
    url: 'https://italianacademy.columbia.edu',
    city: 'Columbia University, New York, NY',
    since: '1991',
    tie: 'none',
    blurb:
      "Columbia's Italian Academy — a fellowship program and scholarly forum funded under an Italy–US agreement, the most academic room in the New York Italian circuit.",
    tags: ['university', 'fellowships'],
  },
  {
    id: 'calandra',
    name: 'John D. Calandra Italian American Institute (CUNY)',
    short: 'Calandra',
    cluster: 'research',
    url: 'https://calandrainstitute.org',
    city: '25 West 43rd Street, New York, NY',
    since: '1979',
    tie: 'none',
    blurb:
      'CUNY research institute on the Italian-American experience — conferences, publications, archives and a Midtown venue that hosts much of the community, including the Italian Heritage & Culture Committee.',
    tags: ['university', 'research', 'venue'],
  },
  {
    id: 'primo-levi',
    name: 'Centro Primo Levi',
    short: 'Centro Primo Levi',
    cluster: 'research',
    url: 'https://primolevicenter.org',
    city: 'New York, NY',
    tie: 'none',
    blurb:
      'Research and public programs on Italian Jewish history and culture, presented across the Italian Cultural Institute, Calandra and Casa Italiana.',
    tags: ['research', 'culture'],
  },
  {
    id: 'ai-socratic',
    name: 'AI Socratic',
    short: 'AI Socratic',
    cluster: 'research',
    url: 'https://aisocratic.org',
    city: 'New York, NY · Milan · online',
    tie: 'none',
    tieNote:
      'Frontier-AI engineers and founders meeting in both our cities — the most direct technical overlap with ITC on this map, and still unconnected.',
    blurb:
      'Decentralized community of applied AI researchers, engineers and founders: Socratic discussions, demos and workshops, with chapters in NYC and Milan.',
    tags: ['ai', 'community'],
  },
  {
    id: 'brodolini',
    name: 'Fondazione Giacomo Brodolini',
    short: 'Brodolini',
    cluster: 'research',
    url: 'https://www.fondazionebrodolini.it',
    city: 'Rome · Brussels',
    since: '1971',
    tie: 'none',
    blurb:
      'Independent research foundation on work, social innovation and economic development at Italian and European level — and a main sponsor of I³/NYC.',
    tags: ['research', 'foundation'],
  },

  // ── Business & trade ──────────────────────────────────────────────────────
  {
    id: 'iacc',
    name: 'Italy-America Chamber of Commerce',
    short: 'IACC',
    cluster: 'business',
    url: 'https://italchamber.org',
    city: '11 East 44th Street, New York, NY',
    since: '1887',
    tie: 'none',
    tieNote:
      'The oldest Italian business institution in the city, with a member base of established companies rather than startups. Complementary, not competing.',
    blurb:
      'Midtown chamber of commerce for Italy–US business since 1887: market-entry and B2B services, the America Buys Italian program, a J-1 exchange visitor program, and a steady calendar of industry networking.',
    tags: ['chamber', 'trade'],
  },
  {
    id: 'gei',
    name: 'GEI — Gruppo Esponenti Italiani',
    short: 'GEI',
    cluster: 'business',
    url: 'https://geinewyork.com',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'Senior Italians running American companies, law firms and institutions — the seniority layer above almost everyone else in this map. President: Mario Calvo Platero.',
    blurb:
      'Invitation-oriented New York forum for the advancement of Italian business, science and culture in the US: monthly luncheons, seminars and conferences with authoritative speakers from both countries.',
    tags: ['executives', 'forum'],
  },
  {
    id: 'ciim',
    name: 'Confederazione Imprenditori Italiani nel Mondo (USA)',
    short: 'CIIM USA',
    cluster: 'business',
    city: 'New York, NY',
    since: '2003',
    tie: 'none',
    blurb:
      'US arm of the global confederation of Italian entrepreneurs abroad, founded in Rome in 2003 as a networking and lobbying platform between diaspora entrepreneurs and Italian business.',
    tags: ['entrepreneurs', 'network'],
  },
  {
    id: 'piazza-italia',
    name: 'Piazza Italia',
    short: 'Piazza Italia',
    cluster: 'business',
    url: 'https://www.pzitalia.com',
    city: '11 East 44th Street, New York, NY',
    tie: 'none',
    blurb:
      'Shared New York headquarters and market-entry platform for Italian jewelry, fashion, furniture and design brands, founded by Dennis Ulrich and Alberto Milani under a "Stronger Together" model. Member of the NIAF business network.',
    tags: ['market entry', 'design'],
  },
  {
    id: 'altagamma',
    name: 'Fondazione Altagamma',
    short: 'Altagamma',
    cluster: 'business',
    url: 'https://altagamma.it',
    city: 'Milan · New York',
    since: '1992',
    tie: 'none',
    blurb:
      "Association of Italy's high-end cultural and creative companies — fashion, design, jewelry, automotive, food, hospitality — behind Icons of Italy, the three-day Manhattan takeover of 43 flagship boutiques in April 2026, supported by the Italian Trade Agency.",
    tags: ['luxury', 'events'],
  },
  {
    id: 'iwfi',
    name: 'Italian Wine & Food Institute',
    short: 'Wine & Food Inst.',
    cluster: 'business',
    city: 'New York, NY',
    since: '1983',
    tie: 'none',
    blurb:
      'New York institute promoting Italian wine and food producers in the US market through trade tastings and showcase events.',
    tags: ['food & wine', 'trade'],
  },
  {
    id: 'aspen-italia',
    name: 'Aspen Institute Italia',
    short: 'Aspen Italia',
    cluster: 'business',
    url: 'https://www.aspeninstitute.it',
    city: 'Rome · Washington DC · New York',
    tie: 'none',
    blurb:
      'Leadership and policy institute running transatlantic programs and an annual Italy–US science award; co-organizer of the "Italy Meets the United States of America" summits in New York.',
    tags: ['policy', 'transatlantic'],
  },

  // ── Italian-American institutions ─────────────────────────────────────────
  {
    id: 'niaf',
    name: 'National Italian American Foundation',
    short: 'NIAF',
    cluster: 'heritage',
    url: 'https://www.niaf.org',
    city: 'Washington, DC · Greater New York region',
    since: '1975',
    tie: 'none',
    tieNote:
      'The largest Italian-American organization in the country, with a Greater New York region, a business network and scholarships. We share programming with its young professionals arm, not yet with NIAF itself.',
    blurb:
      'The national voice of 20+ million Italian Americans — scholarships, business network, regional chapters and a gala circuit that reaches the top of Italian-American business and politics.',
    tags: ['foundation', 'heritage'],
  },
  {
    id: 'niaf-ypn',
    name: 'NIAF Young Professionals Network',
    short: 'NIAF YPN',
    cluster: 'heritage',
    url: 'https://www.niaf.org/programs/young-professionals-network/',
    city: 'New York, NY · Washington, DC',
    tie: 'collaborator',
    tieNote:
      'Co-billed on the December 2025 Italian Tech Club event in New York alongside I³/NYC — our bridge into NIAF.',
    blurb:
      "NIAF's under-40 program: professional networking, mentorship and events that bring the foundation's reach to a younger Italian-American cohort.",
    tags: ['young professionals', 'heritage'],
  },
  {
    id: 'columbus-citizens',
    name: 'Columbus Citizens Foundation',
    short: 'Columbus Citizens',
    cluster: 'heritage',
    url: 'https://columbuscitizens.org',
    city: '8 East 69th Street, New York, NY',
    since: '1944',
    tie: 'none',
    tieNote:
      '$40M+ in scholarships and grants disbursed, and the organizer of the Fifth Avenue Columbus Day Parade. Money and rooms, both underused by the tech side.',
    blurb:
      'Upper East Side foundation fostering Italian-American heritage and achievement — scholarships, grants and New York\'s annual Columbus Celebration and parade since 1929.',
    tags: ['foundation', 'scholarships'],
  },
  {
    id: 'osdia',
    name: 'Order Sons and Daughters of Italy in America',
    short: 'OSDIA',
    cluster: 'heritage',
    url: 'https://osdia.org',
    city: 'Founded in Little Italy, New York, NY',
    since: '1905',
    tie: 'none',
    blurb:
      'The oldest and largest Italian-American fraternal organization, founded in New York\'s Little Italy in 1905, with lodges, scholarships and advocacy across the country.',
    tags: ['fraternal', 'heritage'],
  },
  {
    id: 'noiaw',
    name: 'National Organization of Italian American Women',
    short: 'NOIAW',
    cluster: 'heritage',
    url: 'https://noiaw.org',
    city: '25 West 43rd Street, New York, NY',
    since: '1980',
    tie: 'none',
    tieNote:
      'The only national organization for women of Italian ancestry — mentoring, scholarships and exchange programs. An obvious counterpart for work on gender balance in our own membership.',
    blurb:
      'Midtown-based national network of Italian-American women across professions, founded in 1980 by Aileen Riotto Sirey with Geraldine Ferraro among others: mentoring, scholarships and cultural exchange.',
    tags: ['women', 'mentorship'],
  },
  {
    id: 'ihcc-ny',
    name: 'Italian Heritage & Culture Committee of New York',
    short: 'IHCC-NY',
    cluster: 'heritage',
    url: 'https://italyculturemonth.org',
    city: '25 West 43rd Street, New York, NY',
    since: '1976',
    tie: 'none',
    blurb:
      'Volunteer committee that coordinates Italian Heritage & Culture Month across the tri-state area, based at the Calandra Institute.',
    tags: ['heritage', 'coordination'],
  },
  {
    id: 'fiao-brooklyn',
    name: 'FIAO Il Centro — Federation of Italian-American Organizations of Brooklyn',
    short: 'FIAO Brooklyn',
    cluster: 'heritage',
    url: 'https://fiaobrooklyn.org',
    city: 'Bensonhurst, Brooklyn, NY',
    tie: 'none',
    blurb:
      'Forty-year-old Brooklyn nonprofit and community center serving Bensonhurst — social services, youth programs and the neighborhood\'s Italian civic life.',
    tags: ['community', 'brooklyn'],
  },
  {
    id: 'fiao-queens',
    name: 'Federation of Italian-American Organizations of Queens',
    short: 'FIAO Queens',
    cluster: 'heritage',
    city: 'Astoria, Queens, NY',
    tie: 'none',
    blurb:
      'Umbrella federation of Italian-American societies in Queens, registered with the Consulate General of Italy in New York.',
    tags: ['community', 'queens'],
  },
  {
    id: 'italian-charities',
    name: 'Italian Charities of America',
    short: 'Italian Charities',
    cluster: 'heritage',
    url: 'https://italiancharities.org',
    city: 'Flushing, Queens, NY',
    since: '1936',
    tie: 'none',
    blurb:
      'Queens charitable and cultural organization founded in 1936 — scholarships, language classes and community events out of its own hall.',
    tags: ['charity', 'queens'],
  },
  {
    id: 'new-york-italians',
    name: 'New York Italians',
    short: 'New York Italians',
    cluster: 'heritage',
    url: 'https://www.newyorkitalians.org',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      '2,500+ members reachable through a single events calendar — the largest general-interest Italian audience in the city.',
    blurb:
      'Nonprofit running one of the city\'s busiest Italian cultural calendars — opera, art, lectures, language and culinary programs — with 2,500+ members and professional networking on the side.',
    tags: ['community', 'events'],
  },
  {
    id: 'italian-welfare-league',
    name: 'Italian Welfare League',
    short: 'Welfare League',
    cluster: 'heritage',
    url: 'https://www.italianwelfareleague.org',
    city: 'New York, NY',
    since: '1920',
    tie: 'none',
    blurb:
      'Century-old New York charity founded to assist Italian immigrants, now funding scholarships and aid for Italian Americans in need.',
    tags: ['charity', 'legacy'],
  },
  {
    id: 'ctim-usa',
    name: 'CTIM USA — Comitato Tricolore per gli Italiani nel Mondo',
    short: 'CTIM USA',
    cluster: 'heritage',
    url: 'https://www.ctimusa.com',
    city: 'New York, NY',
    since: '1968',
    tie: 'none',
    blurb:
      'US branch of the worldwide committee for Italians abroad, working on the political and civic representation of Italian communities. New York chapter led by Tomaso Veneroso, who also chairs CIIM.',
    tags: ['advocacy', 'community'],
  },
  {
    id: 'columbian-lawyers',
    name: 'Columbian Lawyers Association of the First Judicial Department',
    short: 'Columbian Lawyers',
    cluster: 'heritage',
    url: 'https://www.columbianlawyers.com',
    city: 'Manhattan & Bronx, NY',
    since: '1955',
    tie: 'none',
    tieNote: 'Italian-heritage lawyers in Manhattan and the Bronx — the professional bench founders need before they need it.',
    blurb:
      'Bar association of lawyers of Italian heritage in Manhattan and the Bronx, promoting Italian culture and achievement within the profession since 1955.',
    tags: ['legal', 'professional'],
  },
  {
    id: 'niaba',
    name: 'National Italian American Bar Association',
    short: 'NIABA',
    cluster: 'heritage',
    url: 'https://www.niaba.org',
    city: 'United States',
    tie: 'none',
    blurb:
      'National association of lawyers, judges and law students of Italian heritage, federating local Italian-American bar organizations.',
    tags: ['legal', 'professional'],
  },
  {
    id: 'morgagni',
    name: 'The Morgagni Medical Society of New York',
    short: 'Morgagni Society',
    cluster: 'heritage',
    url: 'https://www.morgagnimedicalsociety.com',
    city: 'New York, NY',
    since: '1890',
    tie: 'none',
    blurb:
      'Society of physicians of Italian heritage in New York — professional and scientific exchange in continuous operation since 1890.',
    tags: ['medical', 'professional'],
  },
  {
    id: 'italian-american-museum',
    name: 'Italian American Museum',
    short: 'IA Museum',
    cluster: 'heritage',
    url: 'https://www.italianamericanmuseum.org',
    city: '151 Mulberry Street, New York, NY',
    tie: 'none',
    blurb:
      'Little Italy museum whose new building quadrupled exhibition space and opened its permanent show, The Italian American Experience, in summer 2025.',
    tags: ['museum', 'heritage'],
  },
  {
    id: 'ilica',
    name: 'ILICA — Italian Language Inter-Cultural Alliance',
    short: 'ILICA',
    cluster: 'heritage',
    url: 'https://www.ilica.it',
    city: 'New York, NY',
    tie: 'none',
    blurb:
      'Foundation started by Italian business people to promote Italian language and culture in the US, with programs spanning art, medicine, science and tourism. Founded and led by Vincenzo Marra.',
    tags: ['language', 'foundation'],
  },
  {
    id: 'italian-language-foundation',
    name: 'Italian Language Foundation',
    short: 'Italian Language',
    cluster: 'heritage',
    url: 'https://italianlanguagefoundation.org',
    city: 'New York, NY',
    tie: 'none',
    blurb:
      'Nonprofit supporting Italian language education in American schools, including AP Italian, with scholarships and awards for students and teachers.',
    tags: ['language', 'education'],
  },

  // ── Culture & media ───────────────────────────────────────────────────────
  {
    id: 'salotto',
    name: 'Salotto NYC',
    short: 'Salotto',
    cluster: 'culture',
    url: 'https://salotto.nyc',
    city: '84 Withers Street, Brooklyn, NY',
    tie: 'none',
    tieNote:
      'The Italian creative living room of New York, already the venue for I³ networking nights. The most natural room in the city for an ITC evening.',
    blurb:
      'Brooklyn hub for cultural research and production run by nine NYC-based Italian creatives — gallery, studio, event space. Has hosted Jhumpa Lahiri, Alessandro Cattelan, Luca Ravenna and I³/NYC soft-networking nights.',
    tags: ['venue', 'creative'],
  },
  {
    id: 'lavoce',
    name: 'La Voce di New York',
    short: 'La Voce di NY',
    cluster: 'culture',
    url: 'https://lavocedinewyork.com',
    city: 'New York, NY',
    since: '2013',
    tie: 'none',
    tieNote:
      'The paper of record for this ecosystem — it covered I³\'s launch and most of what happens in this map. Coverage is how the rest of the community finds out we exist.',
    blurb:
      'Independent Italian-and-English digital daily founded by Stefano Vaccara — ~600k monthly readers — which in 2025 acquired America Oggi and ICN Radio, consolidating Italian-language media in the US.',
    tags: ['media', 'press'],
  },
  {
    id: 'iitaly',
    name: 'i-Italy',
    short: 'i-Italy',
    cluster: 'culture',
    url: 'https://www.iitaly.org',
    city: 'New York, NY',
    tie: 'none',
    blurb:
      'Bilingual multimedia magazine and TV program on Italian and Italian-American life in New York, closely tied to the city\'s cultural institutions.',
    tags: ['media', 'culture'],
  },
  {
    id: 'madeinitaly-signature',
    name: 'Made in Italy Signature',
    short: 'MdI Signature',
    cluster: 'culture',
    url: 'https://www.instagram.com/madeinitaly.signature/',
    city: 'New York, NY',
    tie: 'none',
    tieNote:
      'Runs Italian-branded nights in the city and reaches a young Italian crowd. Verify who is behind it before putting the club name next to theirs.',
    blurb:
      'Instagram-run promoter of Made in Italy branded events and parties in New York. The account is the whole public footprint: no website, no named organization, no press coverage we could find.',
    tags: ['events', 'instagram-only'],
  },
  {
    id: 'we-the-italians',
    name: 'We The Italians',
    short: 'We The Italians',
    cluster: 'culture',
    url: 'https://www.wetheitalians.com',
    city: 'United States · Italy',
    tie: 'none',
    tieNote:
      'A 100k+ newsletter dedicated to Italy–US ties, built on interviews. The cheapest distribution in this map for anyone with something to say.',
    blurb:
      'Media organization founded by Umberto Mucci covering the ties between Italy and the US — a monthly magazine and newsletter reaching 100,000+ recipients, 300+ interviews, and ambassadors in every US state and Italian region.',
    tags: ['media', 'newsletter'],
  },
];

// Documented working relationships. `note` is the evidence, in one line — if you
// cannot write the note, the edge does not go in.
export const EDGES = [
  // ITC NYC
  { a: ITC_ID, b: 'itc-global', kind: 'network', note: 'NYC is a chapter of the Italian Tech Club network.' },
  { a: ITC_ID, b: 'tih', kind: 'partner', note: 'Member-perk partner since August 2026.' },
  { a: ITC_ID, b: 'tih', kind: 'venue', note: 'Our December 2025 Tech Talk ran in this space, then Impact Hub New York.' },
  { a: ITC_ID, b: 'uis', kind: 'cohost', note: 'ITC x UIS: Meet & Eat, La Piadineria, February 2026.' },
  { a: ITC_ID, b: 'i3nyc', kind: 'cohost', note: 'December 2025 Tech Talk with I³ chair Gianluca Galletto at 417 Fifth Avenue.' },
  { a: ITC_ID, b: 'niaf-ypn', kind: 'cohost', note: 'Co-billed on the December 2025 Italian Tech Club event.' },

  // I³/NYC — the busiest connector in the map
  { a: 'i3nyc', b: 'consulate-ny', kind: 'institutional', note: 'Endorsed by the Consulate; launched there in December 2024; main sponsor.' },
  { a: 'i3nyc', b: 'brodolini', kind: 'institutional', note: 'Fondazione Brodolini is a main sponsor of I³/NYC.' },
  { a: 'i3nyc', b: 'aifi', kind: 'institutional', note: 'AIFI is listed as an I³/NYC sponsor.' },
  { a: 'i3nyc', b: 'italian-innovation-week', kind: 'partner', note: 'I³/NYC organizes Italian Innovation Week.' },
  { a: 'i3nyc', b: 'niaf', kind: 'cohost', note: 'Federico Marchetti conversation, September 2025, with NIAF and Salotto NYC.' },
  { a: 'i3nyc', b: 'salotto', kind: 'cohost', note: 'Recurring soft-networking happy hours at Salotto, plus the Marchetti evening.' },
  { a: 'i3nyc', b: 'niaf-ypn', kind: 'cohost', note: 'Co-hosted the December 2025 Italian Tech Club event.' },
  { a: 'i3nyc', b: 'b4i', kind: 'cohost', note: 'Bocconi 4 Innovation presentation in New York, October 2025.' },
  { a: 'i3nyc', b: 'italian-tech-week', kind: 'cohost', note: 'I³ masterclass and co-sponsored event at Italian Tech Week, October 2025.' },
  { a: 'i3nyc', b: 'smau', kind: 'partner', note: 'I³ at SMAU Milano, November 2025; SMAU supports Innovation Week.' },
  { a: 'i3nyc', b: 'alphaprime', kind: 'network', note: 'Alessandro Piol (AlphaPrime) sits on the I³/NYC board.' },

  // Italian Innovation Week backers
  { a: 'italian-innovation-week', b: 'ita-ny', kind: 'institutional', note: 'Supported by the Italian Trade Agency.' },
  { a: 'italian-innovation-week', b: 'consulate-ny', kind: 'institutional', note: 'Supported by the Consulate General of Italy in New York.' },
  { a: 'italian-innovation-week', b: 'cdp-vc', kind: 'institutional', note: 'CDP among the named sponsors.' },
  { a: 'italian-innovation-week', b: 'smau', kind: 'partner', note: 'SMAU among the named partners.' },

  // TIH / landing platforms
  { a: 'ita-ny', b: 'gener8tor', kind: 'partner', note: 'Global Startup Program NYC accelerator cohort run with gener8tor.' },
  { a: 'ita-ny', b: 'altagamma', kind: 'partner', note: 'Italian Trade Agency support for Icons of Italy in Manhattan, April 2026.' },
  { a: 'ibii', b: 'aspen-italia', kind: 'cohost', note: '"Italy Meets the United States of America" summit, New York.' },
  { a: 'ibii', b: 'mind-the-bridge', kind: 'partner', note: 'Cooperation on the San Francisco side of the investor symposia.' },

  // Institutional network
  { a: 'embassy-dc', b: 'consulate-ny', kind: 'institutional', note: 'Same diplomatic network under the Ministry of Foreign Affairs.' },
  { a: 'consulate-ny', b: 'iic-ny', kind: 'institutional', note: 'The Cultural Institute is the cultural arm of the same network.' },
  { a: 'consulate-ny', b: 'ita-ny', kind: 'institutional', note: 'Trade Agency office within the same Italian public network in New York.' },
  { a: 'consulate-ny', b: 'enit-ny', kind: 'institutional', note: 'Tourist board office within the same Italian public network in New York.' },
  { a: 'consulate-ny', b: 'comites-ny', kind: 'institutional', note: 'Comites is the elected body representing the community to the Consulate.' },
  { a: 'consulate-ny', b: 'iace', kind: 'institutional', note: 'IACE operates under Consulate supervision on an Italian government grant.' },
  { a: 'consulate-ny', b: 'scuola-italia', kind: 'institutional', note: 'Established by the Italian Ministry of Foreign Affairs.' },
  { a: 'consulate-ny', b: 'airicerca-ny', kind: 'institutional', note: 'AIRIcerca New York operates under Consulate patronage.' },
  { a: 'embassy-dc', b: 'innovit', kind: 'institutional', note: 'INNOVIT is promoted by the Ministry of Foreign Affairs and coordinated with the Embassy and San Francisco Consulate.' },
  { a: 'iace', b: 'iic-ny', kind: 'partner', note: 'Language courses run jointly at the Italian Cultural Institute.' },

  // Talent umbrellas
  { a: 'fondazione-nova', b: 'nova-mba', kind: 'network', note: 'NOVA-MBA sits under Fondazione NOVA since 2022.' },
  { a: 'fondazione-nova', b: 'mentors4u', kind: 'network', note: 'Mentors4u sits under Fondazione NOVA since 2022.' },
  { a: 'mentors4u', b: 'aifi', kind: 'partner', note: 'AIFI listed among Mentors4u program partners.' },
  { a: 'nova-talent', b: 'nova-angels', kind: 'network', note: 'Nova Angels invests out of the Nova network.' },
  { a: 'uis', b: 'columbia-italian-society', kind: 'network', note: 'Columbia is among the UIS partner societies.' },
  { a: 'bocconi-alumni-ny', b: 'b4i', kind: 'network', note: 'Same university: alumni chapter and Bocconi accelerator.' },

  // Research & academia
  { a: 'casa-italiana', b: 'italian-academy', kind: 'partner', note: 'Documented collaboration among the New York Italian academic centers.' },
  { a: 'casa-italiana', b: 'calandra', kind: 'partner', note: 'Documented collaboration among the New York Italian academic centers.' },
  { a: 'casa-italiana', b: 'primo-levi', kind: 'partner', note: 'Documented collaboration among the New York Italian academic centers.' },
  { a: 'primo-levi', b: 'calandra', kind: 'venue', note: 'Centro Primo Levi programs hosted at the Calandra Institute.' },
  { a: 'primo-levi', b: 'iic-ny', kind: 'venue', note: 'Centro Primo Levi programs hosted at the Italian Cultural Institute.' },
  { a: 'issnaf', b: 'iic-ny', kind: 'venue', note: 'ISSNAF New York chapter seminars held at the Italian Cultural Institute.' },
  { a: 'calandra', b: 'ihcc-ny', kind: 'venue', note: 'The Heritage & Culture Committee is based at the Calandra Institute.' },

  // Heritage & business
  { a: 'niaf', b: 'niaf-ypn', kind: 'network', note: 'YPN is NIAF\'s under-40 program.' },
  { a: 'niaf', b: 'osdia', kind: 'partner', note: 'NIAF has run conferences in partnership with the Order Sons of Italy.' },
  { a: 'niaf', b: 'piazza-italia', kind: 'network', note: 'Piazza Italia is listed in the NIAF business network.' },
  { a: 'ciim', b: 'ctim-usa', kind: 'network', note: 'Tomaso Veneroso chairs both in New York.' },
  { a: 'niaba', b: 'columbian-lawyers', kind: 'network', note: 'NIABA federates local Italian-American bar organizations.' },
  { a: 'iacc', b: 'piazza-italia', kind: 'network', note: 'Both operate out of 11 East 44th Street, the Italian business address in Midtown.' },
];

// ── Derived helpers ────────────────────────────────────────────────────────

export const ORG_BY_ID = ORGS.reduce((map, org) => {
  map[org.id] = org;
  return map;
}, {});

export const CLUSTER_BY_ID = CLUSTERS.reduce((map, cluster) => {
  map[cluster.id] = cluster;
  return map;
}, {});

export const findOrg = (id) => ORG_BY_ID[id] || null;

// Every edge touching an org, normalized so `other` is always the far end.
export const connectionsFor = (id) =>
  EDGES.filter((edge) => edge.a === id || edge.b === id).map((edge) => ({
    ...edge,
    other: edge.a === id ? edge.b : edge.a,
  }));

export const orgsInCluster = (clusterId) => ORGS.filter((org) => org.cluster === clusterId);

export const tieCounts = () =>
  ORGS.reduce((counts, org) => {
    counts[org.tie] = (counts[org.tie] || 0) + 1;
    return counts;
  }, {});

// ITC's own reach: everything it has a documented link to, itself excluded.
export const itcLinked = () =>
  ORGS.filter((org) => org.id !== ITC_ID && org.tie !== 'none');
