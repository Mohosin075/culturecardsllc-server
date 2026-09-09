import mongoose from 'mongoose'
import config from '../config'
import { Public } from '../app/modules/public/public.model'

export const privacyPolicyHtml = `<div class="legal-document">
  <div class="doc-header">
    <h1>Privacy Policy</h1>
    <p class="last-updated">Last Updated: September 9, 2026</p>
    <p class="lead">CultureCards LLC (“CultureCards,” “we,” “us,” or “our”) respects your privacy.</p>
    <div class="summary-box">
      <p>This Privacy Policy explains how CultureCards LLC collects, uses, protects, and discloses information when you use our mobile application, website, livestreaming services, marketplace, buying and selling features, and related services.</p>
    </div>
  </div>

  <section id="section-1" class="legal-section">
    <h2>1. Information We Collect</h2>
    <p>Depending on how you use CultureCards, we may collect:</p>
    
    <h3>Account Information</h3>
    <p>Name, username, email address, phone number, date of birth, profile information, and authentication information.</p>

    <h3>Buyer &amp; Seller Information</h3>
    <p>Listings, purchases, bids, sales, trades, transaction history, shipping information, reviews, communications, and payout information.</p>

    <h3>Payment Information</h3>
    <p>Payment information may be processed by third-party payment processors. Where reasonably possible, AREIS LLC does not store complete payment-card information on its own systems.</p>

    <h3>Identity Verification Information</h3>
    <p>Where necessary, we or our service providers may collect information required for identity, age, fraud, security, or legal verification.</p>

    <h3>Content</h3>
    <p>Livestreams, videos, photographs, listings, comments, reviews, messages, audio, and other content submitted through the Platform.</p>

    <h3>Technical Information</h3>
    <p>IP address, device information, operating system, application version, browser information, device identifiers, log information, approximate location, crash information, and Platform usage information.</p>
  </section>

  <section id="section-2" class="legal-section">
    <h2>2. How We Use Information</h2>
    <p>AREIS LLC may use information to:</p>
    <ul class="legal-list">
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
  </section>

  <section id="section-3" class="legal-section">
    <h2>3. Buyers &amp; Sellers</h2>
    <h3>Buyers</h3>
    <p>We may use buyer information to process purchases, bids, payments, shipping, refunds, disputes, fraud prevention, and customer support.</p>

    <h3>Sellers</h3>
    <p>We may use seller information to create listings, process sales, facilitate payouts, verify identity, prevent fraud, provide tax-related reporting where required, and maintain marketplace integrity.</p>

    <p>Information necessary to complete a transaction may be shared with appropriate parties, such as payment processors, shipping providers, fraud-prevention providers, or the other transaction participant.</p>
  </section>

  <section id="section-4" class="legal-section">
    <h2>4. Information We Share</h2>
    <p>AREIS LLC may share information with service providers that help us operate the Platform, including providers for:</p>
    <ul class="legal-list">
      <li>Payment processing.</li>
      <li>Cloud hosting.</li>
      <li>Security.</li>
      <li>Identity verification.</li>
      <li>Fraud prevention.</li>
      <li>Analytics.</li>
      <li>Authentication.</li>
      <li>Customer support.</li>
      <li>Communications.</li>
      <li>Shipping.</li>
      <li>Technical infrastructure.</li>
    </ul>
    <p>We may also disclose information when reasonably necessary to comply with law, respond to lawful legal process, investigate fraud, protect users, protect our rights or property, or address security or safety concerns.</p>
    <p><strong>We do not sell passwords, authentication credentials, or similar security credentials.</strong></p>
  </section>

  <section id="section-5" class="legal-section">
    <h2>5. Data Security</h2>
    <p>AREIS LLC takes the security of personal information seriously.</p>
    <p>We maintain reasonable administrative, technical, and physical safeguards appropriate to the nature and sensitivity of information we handle.</p>
    <p>Depending on the system and information involved, these safeguards may include:</p>
    <ul class="legal-list">
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
    <p class="notice">No website, application, database, network, or electronic transmission can be guaranteed to be completely secure.</p>
  </section>

  <section id="section-6" class="legal-section">
    <h2>6. Data Retention</h2>
    <p>AREIS LLC retains information for as long as reasonably necessary to provide the Platform, complete transactions, prevent fraud, maintain business and financial records, resolve disputes, enforce agreements, and comply with legal obligations.</p>
    <p>When information is no longer reasonably required, it may be deleted, anonymized, or securely disposed of, subject to applicable legal and operational requirements.</p>
  </section>

  <section id="section-7" class="legal-section">
    <h2>7. Cookies &amp; Similar Technologies</h2>
    <p>AREIS LLC may use cookies, SDKs, pixels, device identifiers, analytics technologies, and similar technologies to operate the Platform, maintain sessions, remember preferences, understand usage, improve performance, and maintain security.</p>
  </section>

  <section id="section-8" class="legal-section">
    <h2>8. Children’s Privacy</h2>
    <p>AREIS LLC is not intended for children under 13 years of age.</p>
    <p>Certain Platform features may require users to be 18 or older.</p>
    <p>We do not knowingly collect children’s personal information in circumstances prohibited by applicable law.</p>
  </section>

  <section id="section-9" class="legal-section">
    <h2>9. Your Privacy Rights</h2>
    <p>Depending on where you live and whether applicable privacy laws apply to AREIS LLC, you may have rights to:</p>
    <ul class="legal-list">
      <li>Request access to personal information.</li>
      <li>Request correction of inaccurate information.</li>
      <li>Request deletion of personal information.</li>
      <li>Request information about how personal information is collected and used.</li>
      <li>Request a portable copy of certain information.</li>
      <li>Opt out of certain targeted advertising, sale, or sharing of personal information where applicable.</li>
      <li>Exercise other rights provided by applicable law.</li>
    </ul>
    <p>Florida’s 2026 Digital Bill of Rights provides qualifying consumers rights including access, correction, deletion, portability, and certain opt-out rights.</p>
    <p>California’s CCPA, where applicable, provides additional rights including access, deletion, correction, opt-out of sale/sharing, and limiting certain uses of sensitive personal information.</p>
    <p>Rights and eligibility vary depending on the law applicable to you.</p>
  </section>

  <section id="section-10" class="legal-section">
    <h2>10. Privacy Requests</h2>
    <p>To submit a privacy request or privacy-related question, contact:</p>
    <div class="contact-box">
      <p><strong>AREIS LLC</strong><br/>
      Email: <a href="mailto:ceoareisco@gmail.com">ceoareisco@gmail.com</a></p>
    </div>
    <p>We may take reasonable steps to verify your identity before completing certain requests.</p>
    <p>Where applicable law requires a particular response timeframe or process, AREIS LLC will comply with those requirements.</p>
  </section>

  <section id="section-11" class="legal-section">
    <h2>11. California Privacy Rights</h2>
    <p>If California privacy law applies to AREIS LLC, California residents may have rights under the California Consumer Privacy Act, as amended.</p>
    <p>These may include rights to know, delete, correct, opt out of certain sale or sharing, limit certain uses of sensitive personal information, and receive non-discriminatory treatment for exercising applicable privacy rights.</p>
    <p class="notice">[If applicable, add an in-app “Do Not Sell or Share My Personal Information” / “Your Privacy Choices” mechanism before launch.]</p>
  </section>

  <section id="section-12" class="legal-section">
    <h2>12. Florida Privacy Rights</h2>
    <p>If Florida privacy law applies to AREIS LLC and you qualify as a covered consumer, you may have rights provided by the Florida Digital Bill of Rights.</p>
    <p>Florida law includes rights to access, correct, delete, obtain a portable copy of certain personal data, and opt out of certain processing activities.</p>
    <p>Florida law also requires covered businesses to maintain reasonable administrative, technical, and physical security practices appropriate to the volume and nature of personal data involved.</p>
  </section>

  <section id="section-13" class="legal-section">
    <h2>13. Business Transfers</h2>
    <p>If AREIS LLC is involved in a merger, acquisition, financing, restructuring, sale of assets, bankruptcy, or similar business transaction, information may be transferred as part of that transaction, subject to applicable law.</p>
  </section>

  <section id="section-14" class="legal-section">
    <h2>14. Legal Compliance</h2>
    <p>AREIS LLC may retain or disclose information when reasonably necessary to comply with applicable law, court orders, subpoenas, legal processes, governmental requests, fraud investigations, security investigations, or protection of our users, rights, and property.</p>
  </section>

  <section id="section-15" class="legal-section">
    <h2>15. Changes to This Privacy Policy</h2>
    <p>AREIS LLC may update this Privacy Policy periodically.</p>
    <p>When material changes are made, we may provide notice through the Platform, website, email, or another reasonable method.</p>
    <p>The updated Privacy Policy will display a new “Last Updated” date.</p>
  </section>

  <section id="section-16" class="legal-section">
    <h2>16. Contact AREIS LLC</h2>
    <div class="contact-box">
      <p><strong>AREIS LLC</strong><br/>
      400 N TAMPA ST STE 1550 #650915<br/>
      TAMPA, FL 33602<br/>
      USA</p>
      <p><strong>Privacy &amp; Legal Email:</strong><br/>
      <a href="mailto:ceoareisco@gmail.com">ceoareisco@gmail.com</a></p>
    </div>
  </section>
</div>`

export const termsAndConditionsHtml = `<div class="legal-document">
  <div class="doc-header">
    <h1>Terms &amp; Conditions</h1>
    <p class="last-updated">Last Updated: September 6, 2026</p>
    <p class="lead">These Terms &amp; Conditions (“Terms”) govern your access to and use of the AREIS LLC mobile application, website, livestreaming services, marketplace, bidding features, purchasing, selling, and related services (collectively, the “Platform”).</p>
    <div class="summary-box">
      <p>The Platform is operated by AREIS LLC, a Florida limited liability company (“AREIS,” “we,” “us,” or “our”).</p>
      <p><strong>By creating an account or using the Platform, you agree to these Terms and our Privacy Policy.</strong></p>
    </div>
  </div>

  <section id="section-1" class="legal-section">
    <h2>1. Eligibility &amp; Accounts</h2>
    <p>You must be at least 18 years old and legally capable of entering into binding agreements to use the Platform.</p>
    <p>You agree to provide accurate information and maintain the security of your account credentials.</p>
    <p>You are responsible for activity conducted through your account and must promptly notify AREIS LLC if you believe your account has been compromised.</p>
    <p class="notice">AREIS LLC may require identity, age, payment, or other verification and may suspend or restrict accounts when reasonably necessary for security, fraud prevention, legal compliance, or violations of these Terms.</p>
  </section>

  <section id="section-2" class="legal-section">
    <h2>2. The AREIS Marketplace</h2>
    <p>AREIS LLC provides a technology platform that allows users to interact, livestream, list merchandise, purchase merchandise, place bids, and otherwise participate in online commerce.</p>
    <div class="summary-box">
      <p><strong>AREIS LLC is a marketplace and technology provider.</strong> Unless expressly stated otherwise, AREIS LLC is not the seller, manufacturer, owner, or purchaser of merchandise listed by users. Transactions are generally between the buyer and seller.</p>
    </div>
    <p>AREIS LLC may facilitate transactions, payments, communications, shipping, dispute processes, fraud prevention, and other marketplace functions.</p>
  </section>

  <section id="section-3" class="legal-section">
    <h2>3. Buyer Terms</h2>
    <p>As a buyer, you agree to:</p>
    <ul class="legal-list">
      <li>Review listings carefully before purchasing or bidding.</li>
      <li>Pay for purchases you win or complete.</li>
      <li>Provide accurate shipping and payment information.</li>
      <li>Not engage in fraudulent or abusive purchasing activity.</li>
      <li>Not manipulate auctions or bidding.</li>
      <li>Not use multiple accounts to manipulate transactions.</li>
      <li>Comply with applicable laws.</li>
    </ul>

    <h3>Bids</h3>
    <p>Where a listing identifies a bid as binding, submitting a bid constitutes an offer to purchase the item under the applicable listing terms.</p>
    <p>You may not intentionally place bids you do not intend to honor.</p>
    <p>AREIS LLC may cancel, suspend, investigate, or restrict transactions where we reasonably suspect fraud, manipulation, technical errors, unlawful conduct, or violation of these Terms.</p>
  </section>

  <section id="section-4" class="legal-section">
    <h2>4. Seller Terms</h2>
    <p>Sellers are responsible for everything they list, advertise, sell, or represent through the Platform.</p>
    <p>Sellers must:</p>
    <ul class="legal-list">
      <li>Own or have legal authority to sell listed merchandise.</li>
      <li>Accurately describe merchandise.</li>
      <li>Accurately represent condition, authenticity, quantity, and material characteristics.</li>
      <li>Disclose known defects that would reasonably affect a buyer’s decision.</li>
      <li>Ship merchandise as required by the applicable transaction.</li>
      <li>Comply with applicable laws and regulations.</li>
      <li>Pay applicable Platform fees.</li>
      <li>Maintain accurate payout and tax information.</li>
    </ul>
    <p><strong>Sellers may not knowingly list or sell counterfeit, stolen, fraudulent, illegal, prohibited, or otherwise unauthorized merchandise.</strong></p>
    <p>AREIS LLC may remove listings, delay payouts, restrict accounts, or require additional information when reasonably necessary to protect users or the Platform.</p>
  </section>

  <section id="section-5" class="legal-section">
    <h2>5. Live Streaming</h2>
    <p>Users may livestream content and merchandise through the Platform.</p>
    <p>Users are responsible for their livestreams and content.</p>
    <p>You may not use the Platform to distribute unlawful, fraudulent, threatening, harassing, sexually exploitative, infringing, counterfeit, or otherwise prohibited content.</p>
    <p>AREIS LLC may moderate, restrict, remove, or terminate content or livestreams that violate these Terms, applicable law, or Platform policies.</p>
  </section>

  <section id="section-6" class="legal-section">
    <h2>6. Payments, Fees &amp; Payouts</h2>
    <p>Payments may be processed through third-party payment providers.</p>
    <p>AREIS LLC may charge transaction, marketplace, seller, subscription, promotional, or other fees disclosed through the Platform.</p>
    <p>Payment providers may impose their own terms and fees.</p>
    <p>AREIS LLC may delay or withhold payouts where reasonably necessary to investigate fraud, chargebacks, disputes, suspicious activity, compliance issues, or violations of these Terms.</p>
  </section>

  <section id="section-7" class="legal-section">
    <h2>7. Taxes</h2>
    <p>Users are responsible for their own tax obligations arising from purchases, sales, income, or other transactions conducted through the Platform.</p>
    <p>Where required by law, AREIS LLC or its service providers may collect, report, or remit applicable taxes.</p>
  </section>

  <section id="section-8" class="legal-section">
    <h2>8. Prohibited Activities</h2>
    <p>You may not:</p>
    <ul class="legal-list">
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
  </section>

  <section id="section-9" class="legal-section">
    <h2>9. User Content</h2>
    <p>You retain ownership of content you lawfully own and submit to AREIS LLC.</p>
    <p>By submitting content, including livestreams, photographs, videos, listings, descriptions, comments, reviews, usernames, and messages, you grant AREIS LLC a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, distribute, transmit, process, and otherwise use that content as reasonably necessary to operate, maintain, improve, and promote the Platform.</p>
    <p>You represent that you have the rights necessary to provide such content.</p>
  </section>

  <section id="section-10" class="legal-section">
    <h2>10. Privacy &amp; Security</h2>
    <p>AREIS LLC’s collection and use of personal information is governed by our Privacy Policy.</p>
    <p>AREIS LLC maintains reasonable administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, use, disclosure, alteration, and destruction.</p>
    <p>Depending on the information and systems involved, safeguards may include encryption, access controls, authentication, monitoring, secure infrastructure, backups, and incident-response procedures.</p>
    <p class="notice">No electronic system or method of transmission can be guaranteed to be completely secure.</p>
  </section>

  <section id="section-11" class="legal-section">
    <h2>11. Intellectual Property</h2>
    <p>The AREIS name, trademarks, logos, software, designs, interfaces, databases, and other Platform materials belong to AREIS LLC or its licensors.</p>
    <p>You may not copy, modify, distribute, reproduce, sell, or commercially exploit Platform materials without authorization.</p>
  </section>

  <section id="section-12" class="legal-section">
    <h2>12. Third-Party Services</h2>
    <p>AREIS LLC may use third-party providers for payment processing, identity verification, cloud hosting, analytics, authentication, shipping, communications, security, and other services.</p>
    <p>Third-party services may be governed by their own terms and privacy policies.</p>
  </section>

  <section id="section-13" class="legal-section">
    <h2>13. Suspension &amp; Termination</h2>
    <p>AREIS LLC may suspend, restrict, or terminate accounts or access to the Platform when reasonably necessary because of:</p>
    <ul class="legal-list">
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
  </section>

  <section id="section-14" class="legal-section">
    <h2>14. Disclaimer</h2>
    <div class="summary-box">
      <p><strong>THE PLATFORM IS PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS TO THE MAXIMUM EXTENT PERMITTED BY LAW.</strong></p>
      <p>AREIS LLC DOES NOT GUARANTEE THAT THE PLATFORM WILL ALWAYS BE AVAILABLE, ERROR-FREE, UNINTERRUPTED, COMPLETELY SECURE, OR FREE FROM TECHNICAL PROBLEMS.</p>
      <p>AREIS LLC DOES NOT GUARANTEE THE IDENTITY, HONESTY, AUTHENTICITY, QUALITY, LEGALITY, OR PERFORMANCE OF ANY USER, SELLER, BUYER, LISTING, OR MERCHANDISE.</p>
    </div>
  </section>

  <section id="section-15" class="legal-section">
    <h2>15. Limitation of Liability</h2>
    <div class="summary-box">
      <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, AREIS LLC AND ITS MEMBERS, MANAGERS, OFFICERS, EMPLOYEES, CONTRACTORS, AFFILIATES, AND SERVICE PROVIDERS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.</strong></p>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, AREIS LLC’S TOTAL LIABILITY ARISING FROM YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID DIRECTLY TO AREIS LLC DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR (B) $100.</p>
      <p>Nothing in these Terms limits liability that cannot legally be limited.</p>
    </div>
  </section>

  <section id="section-16" class="legal-section">
    <h2>16. Indemnification</h2>
    <p>To the maximum extent permitted by law, you agree to defend, indemnify, and hold harmless AREIS LLC and its members, managers, officers, employees, contractors, affiliates, and service providers from claims, losses, liabilities, damages, costs, and expenses arising from your violation of these Terms, your content, your unlawful conduct, or your transactions conducted through the Platform.</p>
  </section>

  <section id="section-17" class="legal-section">
    <h2>17. Dispute Resolution</h2>
    <p>To the maximum extent permitted by applicable law, disputes arising from these Terms or the Platform will be resolved through individual binding arbitration, rather than court litigation, except where applicable law provides otherwise.</p>
    <p>You and AREIS LLC agree that disputes will not be brought as class actions or class-wide arbitrations to the maximum extent permitted by law.</p>
    <p class="notice">This section should be reviewed by a Florida attorney before publication because arbitration and class-action provisions have specific legal requirements.</p>
  </section>

  <section id="section-18" class="legal-section">
    <h2>18. Governing Law</h2>
    <p>These Terms are governed by the laws of the State of Florida, except where federal law or mandatory consumer-protection laws provide otherwise.</p>
  </section>

  <section id="section-19" class="legal-section">
    <h2>19. Changes to These Terms</h2>
    <p>AREIS LLC may update these Terms from time to time.</p>
    <p>Material changes may be communicated through the Platform, website, email, or another reasonable method.</p>
    <p>Continued use of the Platform after the effective date of updated Terms constitutes acceptance to the extent permitted by law.</p>
  </section>

  <section id="section-20" class="legal-section">
    <h2>20. Contact AREIS LLC</h2>
    <div class="contact-box">
      <p><strong>AREIS LLC</strong><br/>
      400 N TAMPA ST STE 1550 #650915<br/>
      TAMPA, FL 33602<br/>
      USA</p>
      <p><strong>Email:</strong><br/>
      <a href="mailto:ceoareisco@gmail.com">ceoareisco@gmail.com</a></p>
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
    console.log('✅ Terms & Conditions stored in MongoDB with simple, clean structure:', termsResult._id)

    // 2. Seed Privacy Policy
    const privacyResult = await Public.findOneAndUpdate(
      { type: 'privacy-policy' },
      { $set: { content: privacyPolicyHtml } },
      { new: true, upsert: true },
    )
    console.log('✅ Privacy Policy stored in MongoDB with simple, clean structure:', privacyResult._id)

    console.log('✨ All legal documents successfully updated with simple, user-friendly structure!')
  } catch (error) {
    console.error('❌ Error seeding legal documents:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Database disconnected.')
    process.exit(0)
  }
}

seedLegalDocs()
