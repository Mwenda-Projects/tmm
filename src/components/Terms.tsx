import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Back */}
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: February 2026 · Effective immediately upon registration</p>
        </div>

        <div className="prose prose-sm prose-invert max-w-none space-y-8 text-[14px] leading-7 text-muted-foreground">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. About TellMeMore</h2>
            <p>
              TellMeMore ("we", "us", "the platform") is a peer-to-peer social platform built exclusively
              for verified Kenyan university students. Access requires a valid institutional <strong className="text-foreground">.ac.ke</strong> email
              address. By creating an account or using the platform in any capacity (including as a Gate Crusher
              guest), you agree to these Terms in full.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Eligibility</h2>
            <p>You may use TellMeMore only if you:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Are currently enrolled at a recognised Kenyan university or tertiary institution.</li>
              <li>Are 18 years of age or older, or have obtained parental/guardian consent.</li>
              <li>Provide accurate, truthful information during registration.</li>
              <li>Have not previously been suspended or permanently banned from the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials.
              You must not share your account with any third party. TellMeMore reserves the right to
              suspend or terminate accounts that show evidence of shared access, impersonation, or
              misuse of verification status. Report any unauthorised access immediately through the
              in-app Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Acceptable Use</h2>
            <p>You agree not to use TellMeMore to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Harass, bully, threaten, or intimidate other users.</li>
              <li>Share content that is obscene, discriminatory, defamatory, or unlawful.</li>
              <li>Post content that violates another person's intellectual property rights.</li>
              <li>Impersonate any person, institution, or entity.</li>
              <li>Distribute spam, unsolicited promotions, or malware.</li>
              <li>Scrape, harvest, or systematically collect other users' data.</li>
              <li>Attempt to reverse-engineer, exploit, or disrupt the platform's infrastructure.</li>
              <li>Engage in any activity that violates Kenyan law or university policies.</li>
            </ul>
            <p className="mt-3">
              TellMeMore operates on a trust-based community model. Violations will result in
              warnings, temporary suspension, or permanent removal depending on severity.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Content Ownership</h2>
            <p>
              You retain ownership of content you post. By posting, you grant TellMeMore a non-exclusive,
              royalty-free licence to display and distribute that content on the platform for the purpose
              of operating the service. You may delete your content at any time. TellMeMore does not
              claim ownership of your posts, messages, or media.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Wellness & Mental Health</h2>
            <p>
              TellMeMore includes a Wellness section designed for peer support and shared experiences.
              <strong className="text-foreground"> This is not a clinical service.</strong> Nothing on
              TellMeMore constitutes medical, psychological, or professional counselling advice.
              If you or someone you know is in crisis, please contact:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Befrienders Kenya: <strong className="text-foreground">+254 722 178 177</strong></li>
              <li>Kenya Red Cross Psychosocial Support: <strong className="text-foreground">1199</strong></li>
              <li>Your university counselling centre</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Gate Crusher Access</h2>
            <p>
              Gate Crusher is a 24-hour view-only guest mode. Gate Crushers may browse public content
              but cannot post, message, react, join groups, or initiate video calls. Gate Crusher
              sessions are anonymous and expire automatically. Attempting to circumvent restrictions
              is a breach of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Limitation of Liability</h2>
            <p>
              TellMeMore is provided "as is". We make no warranties regarding uptime, accuracy of
              user-generated content, or fitness for a particular purpose. To the fullest extent
              permitted by Kenyan law, TellMeMore and its operators shall not be liable for any
              indirect, incidental, or consequential damages arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. Changes to These Terms</h2>
            <p>
              We may update these Terms periodically. Significant changes will be communicated via
              an in-app notice. Continued use of TellMeMore after changes constitutes acceptance
              of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Kenya. Any disputes shall
              be resolved under the jurisdiction of Kenyan courts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Contact</h2>
            <p>
              Questions about these Terms? Reach us through the in-app feedback option in Settings,
              or via the OfliX platform at{' '}
              <a
                href="https://oflix-lac.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                oflix-lac.vercel.app
              </a>.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-muted-foreground/60">
          <span>© {new Date().getFullYear()} TellMeMore. Built with{' '}
            <a
              href="https://oflix-lac.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline underline-offset-2"
            >
              OfliX
            </a>.
          </span>
          <Link to="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">
            Privacy Policy →
          </Link>
        </div>

      </div>
    </div>
  );
}