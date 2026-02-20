import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function Privacy() {
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
          <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: February 2026 · Applies to all TellMeMore users</p>
        </div>

        <div className="prose prose-sm prose-invert max-w-none space-y-8 text-[14px] leading-7 text-muted-foreground">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Who We Are</h2>
            <p>
              TellMeMore is a student social platform built and operated in Kenya, designed for
              verified Kenyan university students. This Privacy Policy explains what data we collect,
              why we collect it, and how we protect it. We are committed to transparency and to
              your right to control your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Data We Collect</h2>
            <p>We collect the following categories of data:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong className="text-foreground">Account data:</strong> Your institutional email
                address (.ac.ke), display name, university, and profile photo (optional).
              </li>
              <li>
                <strong className="text-foreground">Content you create:</strong> Posts, comments,
                group messages, wellness entries, and reactions.
              </li>
              <li>
                <strong className="text-foreground">Communication data:</strong> Direct messages and
                video call metadata (duration, participants). Video call streams are peer-to-peer
                via WebRTC and are <strong className="text-foreground">not recorded or stored</strong> by TellMeMore.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong> Pages visited, features used,
                online/offline presence status, and read receipts (within messages).
              </li>
              <li>
                <strong className="text-foreground">Device data:</strong> Browser type, operating system,
                and approximate location (country/region only, derived from IP). We do not collect
                precise GPS location.
              </li>
              <li>
                <strong className="text-foreground">Gate Crusher sessions:</strong> Anonymous session
                tokens that expire after 24 hours. No personal data is linked to Gate Crusher sessions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>To operate and personalise your TellMeMore experience.</li>
              <li>To verify your student status and maintain platform integrity.</li>
              <li>To enable real-time features: messaging, presence indicators, notifications.</li>
              <li>To detect and prevent abuse, spam, and policy violations.</li>
              <li>To improve the platform based on aggregated, anonymised usage patterns.</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> sell your personal data to any
              third party. We do not use your data for targeted advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Data Storage & Security</h2>
            <p>
              Your data is stored securely using <strong className="text-foreground">Supabase</strong>,
              a platform built on PostgreSQL with row-level security (RLS) policies that ensure each
              user can only access data they are authorised to see. Data is encrypted in transit (TLS)
              and at rest.
            </p>
            <p className="mt-3">
              Video calls use WebRTC peer-to-peer encryption. TellMeMore does not sit in the middle
              of your video or audio streams — they travel directly between participants.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Who Can See Your Content</h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong className="text-foreground">Posts:</strong> Visible to all verified TellMeMore users and Gate Crusher guests.</li>
              <li><strong className="text-foreground">Group messages:</strong> Visible to members of that group only.</li>
              <li><strong className="text-foreground">Direct messages:</strong> Visible to you and the recipient only.</li>
              <li><strong className="text-foreground">Wellness entries:</strong> Private to you by default unless you choose to share.</li>
              <li><strong className="text-foreground">Profile:</strong> Visible to verified users. Display name and university are shown; your email is never publicly displayed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Third-Party Services</h2>
            <p>TellMeMore uses the following third-party services to operate:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-foreground">Supabase</strong> — database, authentication, and real-time features.</li>
              <li><strong className="text-foreground">Vercel</strong> — hosting and content delivery.</li>
              <li><strong className="text-foreground">Google STUN / Metered TURN</strong> — WebRTC connection assistance (no call content passes through these).</li>
            </ul>
            <p className="mt-3">
              Each of these services has its own privacy policy. We encourage you to review them if
              you have concerns about specific data handling.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your account data is retained for as long as your account is active.</li>
              <li>Deleted posts and messages are removed from our database within 30 days.</li>
              <li>Gate Crusher session tokens are deleted automatically after 24 hours.</li>
              <li>Notification logs are retained for 90 days then purged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-foreground">Access</strong> — request a copy of the data we hold about you.</li>
              <li><strong className="text-foreground">Correction</strong> — update inaccurate information via Settings.</li>
              <li><strong className="text-foreground">Deletion</strong> — request full account and data deletion via Settings → Delete Account.</li>
              <li><strong className="text-foreground">Portability</strong> — request an export of your content.</li>
              <li><strong className="text-foreground">Objection</strong> — object to specific data processing activities.</li>
            </ul>
            <p className="mt-3">
              To exercise any right, use the in-app Settings page or contact us via{' '}
              <a
                href="https://oflix-lac.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
              >
                OfliX
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. Children's Privacy</h2>
            <p>
              TellMeMore is not intended for anyone under the age of 18. We do not knowingly collect
              data from minors. If you believe a minor has created an account, please report it
              through Settings and we will remove it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy as the platform evolves. We will notify you of
              material changes via an in-app banner at least 7 days before they take effect.
              Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Contact</h2>
            <p>
              For privacy concerns, data requests, or questions about this policy, reach us through
              the Settings page inside the app, or via the OfliX platform at{' '}
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
          <Link to="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">
            ← Terms of Service
          </Link>
        </div>

      </div>
    </div>
  );
}