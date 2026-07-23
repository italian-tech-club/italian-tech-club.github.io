import React from 'react';
import LegalPage from './LegalPage';

const CONTACT_EMAIL = 'ciao@italiantechclubnyc.com';

const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="July 23, 2026">
    <p>
      This Privacy Policy explains how Italian Tech Club NYC ("ITC", "we", "us") handles personal
      information when you create a member profile and use our community features at this website.
    </p>

    <h2>Information we collect</h2>
    <p>When you apply to join or create a profile, we collect:</p>
    <ul>
      <li>Your name, profession, company (optional), and short bio</li>
      <li>Your email address</li>
      <li>Your LinkedIn profile URL and profile photo</li>
      <li>The role and interest tags you select</li>
      <li>Basic usage data such as how many times your profile has been viewed</li>
    </ul>

    <h2>How we use it</h2>
    <ul>
      <li>To run the member directory and let members find and connect with each other</li>
      <li>To verify your email and let you manage or update your own profile</li>
      <li>To review and approve membership applications</li>
      <li>To contact you about your profile or connection requests</li>
    </ul>

    <h2>What is public vs. private</h2>
    <p>
      Once approved, your name, photo, profession, company, bio, tags, and LinkedIn link are visible
      on the community page to other visitors. Your email address is never shown publicly — it is
      used only to manage your profile and send verification and connection messages.
    </p>

    <h2>Sharing</h2>
    <p>
      We do not sell your personal information. We share it only with service providers that help us
      operate the site (for example, our database and email delivery providers) and where required by
      law.
    </p>

    <h2>Data retention and deletion</h2>
    <p>
      We keep your profile until you ask us to remove it. To access, correct, or delete your data,
      email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will handle your
      request.
    </p>

    <h2>Security</h2>
    <p>
      We take reasonable measures to protect your information. Account access uses secure, time-limited
      email links rather than stored passwords. No method of transmission or storage is 100% secure,
      so we cannot guarantee absolute security.
    </p>

    <h2>Children</h2>
    <p>
      This site is not intended for anyone under 13, and we do not knowingly collect information from
      children under 13.
    </p>

    <h2>Changes</h2>
    <p>
      We may update this policy from time to time. Material changes will be reflected by the "Last
      updated" date above.
    </p>

    <h2>Contact</h2>
    <p>
      Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  </LegalPage>
);

export default PrivacyPolicy;
