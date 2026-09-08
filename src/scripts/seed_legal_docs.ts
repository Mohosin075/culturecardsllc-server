import mongoose from 'mongoose'
import config from '../config'
import { Public } from '../app/modules/public/public.model'

export const privacyPolicyHtml = `<div class="legal-doc-container">
  <!-- Document Hero Card -->
  <div class="legal-hero-card">
    <div class="legal-hero-badge">Official Policy Document</div>
    <h1 class="legal-doc-title">Privacy Policy</h1>
    <div class="legal-meta-bar">
      <span class="meta-item"><strong>Last Updated:</strong> September 6, 2026</span>
      <span class="meta-dot">•</span>
      <span class="meta-item">AREIS LLC</span>
      <span class="meta-dot">•</span>
      <span class="meta-item">Tampa, Florida, USA</span>
    </div>
    <p class="legal-lead-text">
      AREIS LLC (“AREIS,” “we,” “us,” or “our”) respects your privacy.
    </p>
    <div class="legal-callout-box">
      <p>
        This Privacy Policy explains how AREIS LLC collects, uses, protects, and discloses information when you use our mobile application, website, livestreaming services, marketplace, buying and selling features, and related services.
      </p>
    </div>
  </div>

  <!-- Section 1: Information We Collect -->
  <section id="section-1" class="legal-section">
    <div class="section-header">
      <span class="section-num">01</span>
      <h2 class="section-title">Information We Collect</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">Depending on how you use AREIS, we may collect:</p>
      
      <div class="subsection-grid">
        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Account Information</h3>
          </div>
          <p>Name, username, email address, phone number, date of birth, profile information, and authentication information.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Buyer &amp; Seller Information</h3>
          </div>
          <p>Listings, purchases, bids, sales, trades, transaction history, shipping information, reviews, communications, and payout information.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Payment Information</h3>
          </div>
          <p>Payment information may be processed by third-party payment processors. Where reasonably possible, AREIS LLC does not store complete payment-card information on its own systems.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Identity Verification Information</h3>
          </div>
          <p>Where necessary, we or our service providers may collect information required for identity, age, fraud, security, or legal verification.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Content</h3>
          </div>
          <p>Livestreams, videos, photographs, listings, comments, reviews, messages, audio, and other content submitted through the Platform.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Technical Information</h3>
          </div>
          <p>IP address, device information, operating system, application version, browser information, device identifiers, log information, approximate location, crash information, and Platform usage information.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Section 2: How We Use Information -->
  <section id="section-2" class="legal-section">
    <div class="section-header">
      <span class="section-num">02</span>
      <h2 class="section-title">How We Use Information</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">AREIS LLC may use information to:</p>
      <ul class="legal-checklist">
        <li>Provide and operate the Platform.</li>
        <li>Create and manage accounts.</li>
        <li>Facilitate buying and selling.</li>
        <li>Process bids and transactions.</li>
        <li>Process payments and payouts.</li>
        <li>Provide livestreaming services.</li>
        <li>Verify users and transactions.</li>
        <li>Prevent fraud and abuse.</li>
        <li>Maintain Platform security.</li>
        <li>Provide customer support.</li>
        <li>Communicate with users.</li>
        <li>Improve Platform functionality.</li>
        <li>Analyze Platform performance.</li>
        <li>Enforce our Terms.</li>
        <li>Comply with applicable law.</li>
        <li>Protect AREIS LLC, our users, and our property.</li>
      </ul>
    </div>
  </section>

  <!-- Section 3: Buyers & Sellers -->
  <section id="section-3" class="legal-section">
    <div class="section-header">
      <span class="section-num">03</span>
      <h2 class="section-title">Buyers &amp; Sellers</h2>
    </div>
    <div class="section-content">
      <div class="subsection-card">
        <div class="subsection-header">
          <span class="sub-dot"></span>
          <h3>Buyers</h3>
        </div>
        <p>We may use buyer information to process purchases, bids, payments, shipping, refunds, disputes, fraud prevention, and customer support.</p>
      </div>

      <div class="subsection-card">
        <div class="subsection-header">
          <span class="sub-dot"></span>
          <h3>Sellers</h3>
        </div>
        <p>We may use seller information to create listings, process sales, facilitate payouts, verify identity, prevent fraud, provide tax-related reporting where required, and maintain marketplace integrity.</p>
      </div>

      <div class="legal-notice-box">
        <p>Information necessary to complete a transaction may be shared with appropriate parties, such as payment processors, shipping providers, fraud-prevention providers, or the other transaction participant.</p>
      </div>
    </div>
  </section>

  <!-- Section 4: Information We Share -->
  <section id="section-4" class="legal-section">
    <div class="section-header">
      <span class="section-num">04</span>
      <h2 class="section-title">Information We Share</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">AREIS LLC may share information with service providers that help us operate the Platform, including providers for:</p>
      
      <div class="providers-tags">
        <span class="tag-item">Payment processing</span>
        <span class="tag-item">Cloud hosting</span>
        <span class="tag-item">Security</span>
        <span class="tag-item">Identity verification</span>
        <span class="tag-item">Fraud prevention</span>
        <span class="tag-item">Analytics</span>
        <span class="tag-item">Authentication</span>
        <span class="tag-item">Customer support</span>
        <span class="tag-item">Communications</span>
        <span class="tag-item">Shipping</span>
        <span class="tag-item">Technical infrastructure</span>
      </div>

      <p>We may also disclose information when reasonably necessary to comply with law, respond to lawful legal process, investigate fraud, protect users, protect our rights or property, or address security or safety concerns.</p>

      <div class="legal-highlight-badge">
        <strong>Strict Policy:</strong> We do not sell passwords, authentication credentials, or similar security credentials.
      </div>
    </div>
  </section>

  <!-- Section 5: Data Security -->
  <section id="section-5" class="legal-section">
    <div class="section-header">
      <span class="section-num">05</span>
      <h2 class="section-title">Data Security</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC takes the security of personal information seriously.</p>
      <p>We maintain reasonable administrative, technical, and physical safeguards appropriate to the nature and sensitivity of information we handle.</p>
      <p>Depending on the system and information involved, these safeguards may include:</p>
      
      <ul class="legal-checklist">
        <li>Encryption during transmission.</li>
        <li>Encryption of sensitive information at rest where appropriate.</li>
        <li>Access controls.</li>
        <li>Authentication and account-security measures.</li>
        <li>Restricted employee and contractor access.</li>
        <li>Security monitoring and logging.</li>
        <li>Secure software and infrastructure practices.</li>
        <li>Backups and recovery procedures.</li>
        <li>Security assessments and vulnerability management.</li>
        <li>Incident-response procedures.</li>
      </ul>

      <p>These practices are consistent with federal guidance encouraging businesses to limit collected information, control access, use encryption, protect data in transit and at rest, and oversee service providers.</p>

      <div class="legal-alert-box">
        <strong>Security Notice:</strong> No website, application, database, network, or electronic transmission can be guaranteed to be completely secure.
      </div>
    </div>
  </section>

  <!-- Section 6: Data Retention -->
  <section id="section-6" class="legal-section">
    <div class="section-header">
      <span class="section-num">06</span>
      <h2 class="section-title">Data Retention</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC retains information for as long as reasonably necessary to provide the Platform, complete transactions, prevent fraud, maintain business and financial records, resolve disputes, enforce agreements, and comply with legal obligations.</p>
      <p>When information is no longer reasonably required, it may be deleted, anonymized, or securely disposed of, subject to applicable legal and operational requirements.</p>
    </div>
  </section>

  <!-- Section 7: Cookies & Similar Technologies -->
  <section id="section-7" class="legal-section">
    <div class="section-header">
      <span class="section-num">07</span>
      <h2 class="section-title">Cookies &amp; Similar Technologies</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC may use cookies, SDKs, pixels, device identifiers, analytics technologies, and similar technologies to operate the Platform, maintain sessions, remember preferences, understand usage, improve performance, and maintain security.</p>
    </div>
  </section>

  <!-- Section 8: Children’s Privacy -->
  <section id="section-8" class="legal-section">
    <div class="section-header">
      <span class="section-num">08</span>
      <h2 class="section-title">Children’s Privacy</h2>
    </div>
    <div class="section-content">
      <div class="legal-warning-box">
        <p>AREIS LLC is not intended for children under 13 years of age.</p>
        <p>Certain Platform features may require users to be 18 or older.</p>
        <p>We do not knowingly collect children’s personal information in circumstances prohibited by applicable law.</p>
      </div>
    </div>
  </section>

  <!-- Section 9: Your Privacy Rights -->
  <section id="section-9" class="legal-section">
    <div class="section-header">
      <span class="section-num">09</span>
      <h2 class="section-title">Your Privacy Rights</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">Depending on where you live and whether applicable privacy laws apply to AREIS LLC, you may have rights to:</p>
      <ul class="legal-checklist">
        <li>Request access to personal information.</li>
        <li>Request correction of inaccurate information.</li>
        <li>Request deletion of personal information.</li>
        <li>Request information about how personal information is collected and used.</li>
        <li>Request a portable copy of certain information.</li>
        <li>Opt out of certain targeted advertising, sale, or sharing of personal information where applicable.</li>
        <li>Exercise other rights provided by applicable law.</li>
      </ul>

      <div class="subsection-grid">
        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>Florida Digital Bill of Rights</h3>
          </div>
          <p>Florida’s 2026 Digital Bill of Rights provides qualifying consumers rights including access, correction, deletion, portability, and certain opt-out rights.</p>
        </div>

        <div class="subsection-card">
          <div class="subsection-header">
            <span class="sub-dot"></span>
            <h3>California Consumer Privacy Act (CCPA)</h3>
          </div>
          <p>California’s CCPA, where applicable, provides additional rights including access, deletion, correction, opt-out of sale/sharing, and limiting certain uses of sensitive personal information.</p>
        </div>
      </div>
      <p class="text-muted">Rights and eligibility vary depending on the law applicable to you.</p>
    </div>
  </section>

  <!-- Section 10: Privacy Requests -->
  <section id="section-10" class="legal-section">
    <div class="section-header">
      <span class="section-num">10</span>
      <h2 class="section-title">Privacy Requests</h2>
    </div>
    <div class="section-content">
      <p>To submit a privacy request or privacy-related question, contact:</p>
      <div class="contact-pill">
        <strong>AREIS LLC</strong><br/>
        Email: <a href="mailto:ceoareisco@gmail.com" class="link-styled">ceoareisco@gmail.com</a>
      </div>
      <p>We may take reasonable steps to verify your identity before completing certain requests.</p>
      <p>Where applicable law requires a particular response timeframe or process, AREIS LLC will comply with those requirements.</p>
    </div>
  </section>

  <!-- Section 11: California Privacy Rights -->
  <section id="section-11" class="legal-section">
    <div class="section-header">
      <span class="section-num">11</span>
      <h2 class="section-title">California Privacy Rights</h2>
    </div>
    <div class="section-content">
      <p>If California privacy law applies to AREIS LLC, California residents may have rights under the California Consumer Privacy Act, as amended.</p>
      <p>These may include rights to know, delete, correct, opt out of certain sale or sharing, limit certain uses of sensitive personal information, and receive non-discriminatory treatment for exercising applicable privacy rights.</p>
      <div class="legal-notice-box">
        <p>[If applicable, add an in-app “Do Not Sell or Share My Personal Information” / “Your Privacy Choices” mechanism before launch.]</p>
      </div>
    </div>
  </section>

  <!-- Section 12: Florida Privacy Rights -->
  <section id="section-12" class="legal-section">
    <div class="section-header">
      <span class="section-num">12</span>
      <h2 class="section-title">Florida Privacy Rights</h2>
    </div>
    <div class="section-content">
      <p>If Florida privacy law applies to AREIS LLC and you qualify as a covered consumer, you may have rights provided by the Florida Digital Bill of Rights.</p>
      <p>Florida law includes rights to access, correct, delete, obtain a portable copy of certain personal data, and opt out of certain processing activities.</p>
      <p>Florida law also requires covered businesses to maintain reasonable administrative, technical, and physical security practices appropriate to the volume and nature of personal data involved.</p>
    </div>
  </section>

  <!-- Section 13: Business Transfers -->
  <section id="section-13" class="legal-section">
    <div class="section-header">
      <span class="section-num">13</span>
      <h2 class="section-title">Business Transfers</h2>
    </div>
    <div class="section-content">
      <p>If AREIS LLC is involved in a merger, acquisition, financing, restructuring, sale of assets, bankruptcy, or similar business transaction, information may be transferred as part of that transaction, subject to applicable law.</p>
    </div>
  </section>

  <!-- Section 14: Legal Compliance -->
  <section id="section-14" class="legal-section">
    <div class="section-header">
      <span class="section-num">14</span>
      <h2 class="section-title">Legal Compliance</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC may retain or disclose information when reasonably necessary to comply with applicable law, court orders, subpoenas, legal processes, governmental requests, fraud investigations, security investigations, or protection of our users, rights, and property.</p>
    </div>
  </section>

  <!-- Section 15: Changes to This Privacy Policy -->
  <section id="section-15" class="legal-section">
    <div class="section-header">
      <span class="section-num">15</span>
      <h2 class="section-title">Changes to This Privacy Policy</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC may update this Privacy Policy periodically.</p>
      <p>When material changes are made, we may provide notice through the Platform, website, email, or another reasonable method.</p>
      <p>The updated Privacy Policy will display a new “Last Updated” date.</p>
    </div>
  </section>

  <!-- Section 16: Contact AREIS LLC -->
  <section id="section-16" class="legal-section">
    <div class="section-header">
      <span class="section-num">16</span>
      <h2 class="section-title">Contact AREIS LLC</h2>
    </div>
    <div class="section-content">
      <div class="legal-contact-card">
        <div class="contact-header">
          <h3>AREIS LLC</h3>
          <span class="contact-badge">Corporate Headquarters</span>
        </div>
        <div class="contact-details">
          <p class="address-line">
            400 N TAMPA ST STE 1550 #650915<br/>
            TAMPA, FL 33602<br/>
            USA
          </p>
          <div class="email-block">
            <span class="email-label">Privacy &amp; Legal Email:</span>
            <a href="mailto:ceoareisco@gmail.com" class="email-link">ceoareisco@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>`

export const termsAndConditionsHtml = `<div class="legal-doc-container">
  <!-- Document Hero Card -->
  <div class="legal-hero-card">
    <div class="legal-hero-badge">Terms of Service &amp; Agreement</div>
    <h1 class="legal-doc-title">Terms &amp; Conditions</h1>
    <div class="legal-meta-bar">
      <span class="meta-item"><strong>Last Updated:</strong> September 6, 2026</span>
      <span class="meta-dot">•</span>
      <span class="meta-item">AREIS LLC</span>
      <span class="meta-dot">•</span>
      <span class="meta-item">Tampa, Florida, USA</span>
    </div>
    <p class="legal-lead-text">
      These Terms &amp; Conditions (“Terms”) govern your access to and use of the AREIS LLC mobile application, website, livestreaming services, marketplace, bidding features, purchasing, selling, and related services (collectively, the “Platform”).
    </p>
    <div class="legal-callout-box">
      <p>
        The Platform is operated by AREIS LLC, a Florida limited liability company (“AREIS,” “we,” “us,” or “our”).
      </p>
      <p class="mt-2 font-semibold">
        By creating an account or using the Platform, you agree to these Terms and our Privacy Policy.
      </p>
    </div>
  </div>

  <!-- Section 1: Eligibility & Accounts -->
  <section id="section-1" class="legal-section">
    <div class="section-header">
      <span class="section-num">01</span>
      <h2 class="section-title">Eligibility &amp; Accounts</h2>
    </div>
    <div class="section-content">
      <p>You must be at least 18 years old and legally capable of entering into binding agreements to use the Platform.</p>
      <p>You agree to provide accurate information and maintain the security of your account credentials.</p>
      <p>You are responsible for activity conducted through your account and must promptly notify AREIS LLC if you believe your account has been compromised.</p>
      <div class="legal-notice-box">
        <p>AREIS LLC may require identity, age, payment, or other verification and may suspend or restrict accounts when reasonably necessary for security, fraud prevention, legal compliance, or violations of these Terms.</p>
      </div>
    </div>
  </section>

  <!-- Section 2: The AREIS Marketplace -->
  <section id="section-2" class="legal-section">
    <div class="section-header">
      <span class="section-num">02</span>
      <h2 class="section-title">The AREIS Marketplace</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC provides a technology platform that allows users to interact, livestream, list merchandise, purchase merchandise, place bids, and otherwise participate in online commerce.</p>
      
      <div class="legal-alert-box">
        <strong>Marketplace Model:</strong> AREIS LLC is a marketplace and technology provider. Unless expressly stated otherwise, AREIS LLC is not the seller, manufacturer, owner, or purchaser of merchandise listed by users. Transactions are generally between the buyer and seller.
      </div>

      <p>AREIS LLC may facilitate transactions, payments, communications, shipping, dispute processes, fraud prevention, and other marketplace functions.</p>
    </div>
  </section>

  <!-- Section 3: Buyer Terms -->
  <section id="section-3" class="legal-section">
    <div class="section-header">
      <span class="section-num">03</span>
      <h2 class="section-title">Buyer Terms</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">As a buyer, you agree to:</p>
      <ul class="legal-checklist">
        <li>Review listings carefully before purchasing or bidding.</li>
        <li>Pay for purchases you win or complete.</li>
        <li>Provide accurate shipping and payment information.</li>
        <li>Not engage in fraudulent or abusive purchasing activity.</li>
        <li>Not manipulate auctions or bidding.</li>
        <li>Not use multiple accounts to manipulate transactions.</li>
        <li>Comply with applicable laws.</li>
      </ul>

      <div class="subsection-card">
        <div class="subsection-header">
          <span class="sub-dot"></span>
          <h3>Bids</h3>
        </div>
        <p>Where a listing identifies a bid as binding, submitting a bid constitutes an offer to purchase the item under the applicable listing terms.</p>
        <p>You may not intentionally place bids you do not intend to honor.</p>
        <p class="text-muted">AREIS LLC may cancel, suspend, investigate, or restrict transactions where we reasonably suspect fraud, manipulation, technical errors, unlawful conduct, or violation of these Terms.</p>
      </div>
    </div>
  </section>

  <!-- Section 4: Seller Terms -->
  <section id="section-4" class="legal-section">
    <div class="section-header">
      <span class="section-num">04</span>
      <h2 class="section-title">Seller Terms</h2>
    </div>
    <div class="section-content">
      <p>Sellers are responsible for everything they list, advertise, sell, or represent through the Platform.</p>
      <p class="section-intro">Sellers must:</p>
      <ul class="legal-checklist">
        <li>Own or have legal authority to sell listed merchandise.</li>
        <li>Accurately describe merchandise.</li>
        <li>Accurately represent condition, authenticity, quantity, and material characteristics.</li>
        <li>Disclose known defects that would reasonably affect a buyer’s decision.</li>
        <li>Ship merchandise as required by the applicable transaction.</li>
        <li>Comply with applicable laws and regulations.</li>
        <li>Pay applicable Platform fees.</li>
        <li>Maintain accurate payout and tax information.</li>
      </ul>

      <div class="legal-warning-box">
        <strong>Strict Prohibition:</strong> Sellers may not knowingly list or sell counterfeit, stolen, fraudulent, illegal, prohibited, or otherwise unauthorized merchandise.
      </div>

      <p>AREIS LLC may remove listings, delay payouts, restrict accounts, or require additional information when reasonably necessary to protect users or the Platform.</p>
    </div>
  </section>

  <!-- Section 5: Live Streaming -->
  <section id="section-5" class="legal-section">
    <div class="section-header">
      <span class="section-num">05</span>
      <h2 class="section-title">Live Streaming</h2>
    </div>
    <div class="section-content">
      <p>Users may livestream content and merchandise through the Platform.</p>
      <p>Users are responsible for their livestreams and content.</p>
      <p>You may not use the Platform to distribute unlawful, fraudulent, threatening, harassing, sexually exploitative, infringing, counterfeit, or otherwise prohibited content.</p>
      <div class="legal-notice-box">
        <p>AREIS LLC may moderate, restrict, remove, or terminate content or livestreams that violate these Terms, applicable law, or Platform policies.</p>
      </div>
    </div>
  </section>

  <!-- Section 6: Payments, Fees & Payouts -->
  <section id="section-6" class="legal-section">
    <div class="section-header">
      <span class="section-num">06</span>
      <h2 class="section-title">Payments, Fees &amp; Payouts</h2>
    </div>
    <div class="section-content">
      <p>Payments may be processed through third-party payment providers.</p>
      <p>AREIS LLC may charge transaction, marketplace, seller, subscription, promotional, or other fees disclosed through the Platform.</p>
      <p>Payment providers may impose their own terms and fees.</p>
      <div class="legal-notice-box">
        <p>AREIS LLC may delay or withhold payouts where reasonably necessary to investigate fraud, chargebacks, disputes, suspicious activity, compliance issues, or violations of these Terms.</p>
      </div>
    </div>
  </section>

  <!-- Section 7: Taxes -->
  <section id="section-7" class="legal-section">
    <div class="section-header">
      <span class="section-num">07</span>
      <h2 class="section-title">Taxes</h2>
    </div>
    <div class="section-content">
      <p>Users are responsible for their own tax obligations arising from purchases, sales, income, or other transactions conducted through the Platform.</p>
      <p>Where required by law, AREIS LLC or its service providers may collect, report, or remit applicable taxes.</p>
    </div>
  </section>

  <!-- Section 8: Prohibited Activities -->
  <section id="section-8" class="legal-section">
    <div class="section-header">
      <span class="section-num">08</span>
      <h2 class="section-title">Prohibited Activities</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">You may not:</p>
      <ul class="legal-prohibited-list">
        <li>Commit fraud or deception.</li>
        <li>Manipulate bids or auctions.</li>
        <li>Conduct shill bidding.</li>
        <li>Circumvent Platform fees.</li>
        <li>Sell prohibited or unlawful goods.</li>
        <li>Sell counterfeit or stolen merchandise.</li>
        <li>Impersonate another person.</li>
        <li>Create fraudulent accounts.</li>
        <li>Harass or threaten users.</li>
        <li>Scrape or improperly collect user information.</li>
        <li>Attempt unauthorized access to Platform systems.</li>
        <li>Introduce malware or malicious code.</li>
        <li>Interfere with Platform operations.</li>
        <li>Reverse engineer the Platform except where legally permitted.</li>
        <li>Use the Platform for unlawful financial activity.</li>
      </ul>
    </div>
  </section>

  <!-- Section 9: User Content -->
  <section id="section-9" class="legal-section">
    <div class="section-header">
      <span class="section-num">09</span>
      <h2 class="section-title">User Content</h2>
    </div>
    <div class="section-content">
      <p>You retain ownership of content you lawfully own and submit to AREIS LLC.</p>
      <p>By submitting content, including livestreams, photographs, videos, listings, descriptions, comments, reviews, usernames, and messages, you grant AREIS LLC a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, distribute, transmit, process, and otherwise use that content as reasonably necessary to operate, maintain, improve, and promote the Platform.</p>
      <p>You represent that you have the rights necessary to provide such content.</p>
    </div>
  </section>

  <!-- Section 10: Privacy & Security -->
  <section id="section-10" class="legal-section">
    <div class="section-header">
      <span class="section-num">10</span>
      <h2 class="section-title">Privacy &amp; Security</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC’s collection and use of personal information is governed by our Privacy Policy.</p>
      <p>AREIS LLC maintains reasonable administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, use, disclosure, alteration, and destruction.</p>
      <p>Depending on the information and systems involved, safeguards may include encryption, access controls, authentication, monitoring, secure infrastructure, backups, and incident-response procedures.</p>
      <div class="legal-alert-box">
        <strong>Security Notice:</strong> No electronic system or method of transmission can be guaranteed to be completely secure.
      </div>
    </div>
  </section>

  <!-- Section 11: Intellectual Property -->
  <section id="section-11" class="legal-section">
    <div class="section-header">
      <span class="section-num">11</span>
      <h2 class="section-title">Intellectual Property</h2>
    </div>
    <div class="section-content">
      <p>The AREIS name, trademarks, logos, software, designs, interfaces, databases, and other Platform materials belong to AREIS LLC or its licensors.</p>
      <div class="legal-highlight-badge">
        <strong>Protection of Property:</strong> You may not copy, modify, distribute, reproduce, sell, or commercially exploit Platform materials without authorization.
      </div>
    </div>
  </section>

  <!-- Section 12: Third-Party Services -->
  <section id="section-12" class="legal-section">
    <div class="section-header">
      <span class="section-num">12</span>
      <h2 class="section-title">Third-Party Services</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC may use third-party providers for payment processing, identity verification, cloud hosting, analytics, authentication, shipping, communications, security, and other services.</p>
      <p>Third-party services may be governed by their own terms and privacy policies.</p>
    </div>
  </section>

  <!-- Section 13: Suspension & Termination -->
  <section id="section-13" class="legal-section">
    <div class="section-header">
      <span class="section-num">13</span>
      <h2 class="section-title">Suspension &amp; Termination</h2>
    </div>
    <div class="section-content">
      <p class="section-intro">AREIS LLC may suspend, restrict, or terminate accounts or access to the Platform when reasonably necessary because of:</p>
      <ul class="legal-checklist">
        <li>Violations of these Terms.</li>
        <li>Fraud or suspected fraud.</li>
        <li>Security concerns.</li>
        <li>Unlawful activity.</li>
        <li>Abuse of other users.</li>
        <li>Manipulation of transactions.</li>
        <li>False or misleading information.</li>
        <li>Other conduct that creates risk to AREIS LLC or its users.</li>
      </ul>
      <p>Termination does not eliminate obligations that arose before termination.</p>
    </div>
  </section>

  <!-- Section 14: Disclaimer -->
  <section id="section-14" class="legal-section">
    <div class="section-header">
      <span class="section-num">14</span>
      <h2 class="section-title">Disclaimer</h2>
    </div>
    <div class="section-content">
      <div class="legal-statement-box">
        <p class="uppercase font-bold text-white mb-2">The Platform is provided on an “as is” and “as available” basis to the maximum extent permitted by law.</p>
        <p class="text-zinc-300 mb-2">AREIS LLC does not guarantee that the Platform will always be available, error-free, uninterrupted, completely secure, or free from technical problems.</p>
        <p class="text-zinc-300">AREIS LLC does not guarantee the identity, honesty, authenticity, quality, legality, or performance of any user, seller, buyer, listing, or merchandise.</p>
      </div>
    </div>
  </section>

  <!-- Section 15: Limitation of Liability -->
  <section id="section-15" class="legal-section">
    <div class="section-header">
      <span class="section-num">15</span>
      <h2 class="section-title">Limitation of Liability</h2>
    </div>
    <div class="section-content">
      <div class="legal-statement-box">
        <p class="uppercase font-bold text-white mb-2">To the maximum extent permitted by law, AREIS LLC and its members, managers, officers, employees, contractors, affiliates, and service providers shall not be liable for indirect, incidental, special, exemplary, or punitive damages arising from your use of the Platform.</p>
        <p class="text-zinc-300 mb-2">To the maximum extent permitted by law, AREIS LLC’s total liability arising from your use of the Platform shall not exceed the greater of (A) the amount you paid directly to AREIS LLC during the twelve months before the event giving rise to the claim or (B) $100.</p>
        <p class="text-zinc-400 text-xs">Nothing in these Terms limits liability that cannot legally be limited.</p>
      </div>
    </div>
  </section>

  <!-- Section 16: Indemnification -->
  <section id="section-16" class="legal-section">
    <div class="section-header">
      <span class="section-num">16</span>
      <h2 class="section-title">Indemnification</h2>
    </div>
    <div class="section-content">
      <p>To the maximum extent permitted by law, you agree to defend, indemnify, and hold harmless AREIS LLC and its members, managers, officers, employees, contractors, affiliates, and service providers from claims, losses, liabilities, damages, costs, and expenses arising from your violation of these Terms, your content, your unlawful conduct, or your transactions conducted through the Platform.</p>
    </div>
  </section>

  <!-- Section 17: Dispute Resolution -->
  <section id="section-17" class="legal-section">
    <div class="section-header">
      <span class="section-num">17</span>
      <h2 class="section-title">Dispute Resolution</h2>
    </div>
    <div class="section-content">
      <p>To the maximum extent permitted by applicable law, disputes arising from these Terms or the Platform will be resolved through individual binding arbitration, rather than court litigation, except where applicable law provides otherwise.</p>
      <p>You and AREIS LLC agree that disputes will not be brought as class actions or class-wide arbitrations to the maximum extent permitted by law.</p>
      <div class="legal-notice-box">
        <p>This section should be reviewed by a Florida attorney before publication because arbitration and class-action provisions have specific legal requirements.</p>
      </div>
    </div>
  </section>

  <!-- Section 18: Governing Law -->
  <section id="section-18" class="legal-section">
    <div class="section-header">
      <span class="section-num">18</span>
      <h2 class="section-title">Governing Law</h2>
    </div>
    <div class="section-content">
      <p>These Terms are governed by the laws of the State of Florida, except where federal law or mandatory consumer-protection laws provide otherwise.</p>
    </div>
  </section>

  <!-- Section 19: Changes to These Terms -->
  <section id="section-19" class="legal-section">
    <div class="section-header">
      <span class="section-num">19</span>
      <h2 class="section-title">Changes to These Terms</h2>
    </div>
    <div class="section-content">
      <p>AREIS LLC may update these Terms from time to time.</p>
      <p>Material changes may be communicated through the Platform, website, email, or another reasonable method.</p>
      <p>Continued use of the Platform after the effective date of updated Terms constitutes acceptance to the extent permitted by law.</p>
    </div>
  </section>

  <!-- Section 20: Contact AREIS LLC -->
  <section id="section-20" class="legal-section">
    <div class="section-header">
      <span class="section-num">20</span>
      <h2 class="section-title">Contact AREIS LLC</h2>
    </div>
    <div class="section-content">
      <div class="legal-contact-card">
        <div class="contact-header">
          <h3>AREIS LLC</h3>
          <span class="contact-badge">Corporate Headquarters</span>
        </div>
        <div class="contact-details">
          <p class="address-line">
            400 N TAMPA ST STE 1550 #650915<br/>
            TAMPA, FL 33602<br/>
            USA
          </p>
          <div class="email-block">
            <span class="email-label">Legal Inquiries Email:</span>
            <a href="mailto:ceoareisco@gmail.com" class="email-link">ceoareisco@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>`

async function seedLegalDocs() {
  try {
    console.log('Connecting to database...')
    await mongoose.connect(config.database_url as string)
    console.log('🚀 Database connected successfully')

    // 1. Seed Terms & Conditions
    const termsResult = await Public.findOneAndUpdate(
      { type: 'terms-and-condition' },
      { $set: { content: termsAndConditionsHtml } },
      { new: true, upsert: true },
    )
    console.log('✅ Terms & Conditions stored in MongoDB with rich structure:', termsResult._id)

    // 2. Seed Privacy Policy
    const privacyResult = await Public.findOneAndUpdate(
      { type: 'privacy-policy' },
      { $set: { content: privacyPolicyHtml } },
      { new: true, upsert: true },
    )
    console.log('✅ Privacy Policy stored in MongoDB with rich structure:', privacyResult._id)

    console.log('✨ All legal documents successfully updated with premium UI structure!')
  } catch (error) {
    console.error('❌ Error seeding legal documents:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Database disconnected.')
    process.exit(0)
  }
}

seedLegalDocs()
