import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';

const CONTACT_EMAIL = 'ciao@italiantechclubnyc.com';

const TermsOfService = () => (
  <LegalPage title="Terms of Service" lastUpdated="July 23, 2026">
    <p>
      These Terms govern your use of the Italian Tech Club NYC ("ITC") community website and features.
      By creating a profile or using the site, you agree to these Terms.
    </p>

    <h2>Eligibility</h2>
    <p>
      You must be at least 13 years old to use this site and create a profile. By using the site you
      confirm that you meet this requirement.
    </p>

    <h2>Your account and profile</h2>
    <ul>
      <li>You agree to provide accurate information and keep it up to date.</li>
      <li>You are responsible for the content you submit, including your photo and bio.</li>
      <li>Access to manage your profile is tied to your email — keep access to it secure.</li>
    </ul>

    <h2>Acceptable use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Post false, misleading, offensive, or unlawful content</li>
      <li>Impersonate another person or misrepresent your affiliation</li>
      <li>Harass, spam, or misuse other members' information or contact details</li>
      <li>Attempt to disrupt, scrape, or gain unauthorized access to the site</li>
    </ul>

    <h2>Content you post</h2>
    <p>
      You keep ownership of the content you submit. By submitting it, you grant ITC a non-exclusive
      license to display it on the community page for the purpose of operating the directory.
    </p>

    <h2>Moderation</h2>
    <p>
      Membership is subject to review. We may reject, edit, suspend, or remove any profile or content
      at our discretion, including for violations of these Terms.
    </p>

    <h2>Disclaimer</h2>
    <p>
      The site is provided "as is" without warranties of any kind. We do not verify or endorse members
      and are not responsible for interactions between members.
    </p>

    <h2>Limitation of liability</h2>
    <p>
      To the fullest extent permitted by law, ITC and its organizers will not be liable for any
      indirect, incidental, or consequential damages arising from your use of the site.
    </p>

    <h2>Privacy</h2>
    <p>
      Your use of the site is also governed by our <Link to="/privacy">Privacy Policy</Link>.
    </p>

    <h2>Changes</h2>
    <p>
      We may update these Terms from time to time. Continued use after changes means you accept the
      updated Terms.
    </p>

    <h2>Contact</h2>
    <p>
      Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  </LegalPage>
);

export default TermsOfService;
