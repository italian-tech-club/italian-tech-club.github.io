/**
 * The "you're in" email for a member created by the Gomry sync.
 *
 * Acceptance on Gomry is now the only approval step — there is no separate ITC
 * review — so the person is a member before they know a profile exists. This is
 * what tells them, and it carries the sign-in link that claims it.
 *
 * Distinct from the admin claim campaign in the community route: that one chases
 * the historical CSV roster ("we set this up from our records"), while this
 * responds to a specific acceptance that just happened.
 *
 * Takes the caller's CommunityProfile model rather than importing one, because
 * the Vercel function registers its own copy of the schema — importing
 * server/models here would double-register the mongoose model and throw.
 */
import crypto from 'crypto';
import { sendEmail, campaignHtml, fillTemplate, SITE_URL } from './email.js';

// Matches APPROVAL_TOKEN_TTL_MS in the community route — the sign-in link in an
// acceptance email is good for a week.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SUBJECT = "You're in — your Italian Tech Club NYC profile is ready 🇮🇹";
const BUTTON_LABEL = 'Claim & Sign In';

const BODY = `Ciao {{firstName}}!

Your application to the Italian Tech Club was accepted — benvenuto/a nella community di New York! 🎉

We've already created your member profile from your application, so there's nothing to fill in. Claim it to make it live in the member directory, browse the other members, and start connecting.

Click below to sign in and claim your profile. The link expires in 7 days.`;

/**
 * Send the welcome/claim email for one freshly created profile.
 *
 * Returns 'sent', 'already-notified' (a welcome or claim email has gone out
 * before — never mail the same person twice automatically), or 'failed'.
 * Never throws: a mail problem must not undo a member's profile.
 */
export async function sendMemberWelcome({ profile, model }) {
  if (!profile?.email) return 'failed';
  if (profile.claimEmailCount > 0 || profile.lastClaimEmailAt) return 'already-notified';

  const token = crypto.randomBytes(32).toString('hex');
  const link = `${SITE_URL}/community/manage?token=${token}`;
  const context = { firstName: profile.firstName, lastName: profile.lastName, link };

  try {
    // Token first, so the link already works when the mail lands.
    await model.updateOne(
      { _id: profile._id },
      {
        $set: {
          manageTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          manageTokenExpiry: new Date(Date.now() + TOKEN_TTL_MS),
        },
      },
    );

    const ok = await sendEmail({
      to: profile.email,
      subject: SUBJECT,
      html: campaignHtml({
        bodyHtml: fillTemplate(BODY, context),
        link,
        buttonLabel: BUTTON_LABEL,
      }),
    });

    if (!ok) return 'failed';

    // Stamped only on a confirmed send, so a failure is retried next run and
    // shows as "never emailed" in the admin dashboard meanwhile.
    await model.updateOne(
      { _id: profile._id },
      { $set: { lastClaimEmailAt: new Date() }, $inc: { claimEmailCount: 1 } },
    );
    return 'sent';
  } catch (error) {
    console.error(`sendMemberWelcome(${profile.email}) failed:`, error.message);
    return 'failed';
  }
}
