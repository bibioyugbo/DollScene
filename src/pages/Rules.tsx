import { LegalPage } from './Legal'

/** Community rules for an 18+ social world. Plain language, enforced through reports and moderation. */
export default function Rules() {
  return (
    <LegalPage title="Community Rules">
      <p>DollScene is for adults. Be bold with your looks, kind with your words.</p>
      <h2>Consent and respect</h2>
      <p>No harassment, threats, hate, or targeting people for their race, ethnicity, religion, gender, sexuality or body. Take no for an answer, in chats and in friend requests.</p>
      <h2>Sexual content</h2>
      <p>Flirting is fine. Explicit sexual content, sexual messages to people who haven’t welcomed them, and anything involving minors are not. Accounts that break this are removed and may be reported to authorities.</p>
      <h2>Be real about who you are</h2>
      <p>Don’t impersonate real people or brands. Residents marked “NPC” are fictional characters run by us.</p>
      <h2>Your content</h2>
      <p>Only post what you have the right to share. No spam, scams or selling accounts.</p>
      <h2>Safety tools</h2>
      <p>Block, report and privacy controls are on every profile and message. Reports go to our moderators. Messages are text-only.</p>
      <p className="text-sm text-muted-foreground">Draft. Have these reviewed alongside the Terms before launch.</p>
    </LegalPage>
  )
}
