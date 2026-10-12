import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '../components/Logo'
import { APP_NAME } from '../config/env'

/**
 * Placeholder legal pages. Have a lawyer replace these before launch
 * (NDPR/GDPR, age verification, payments, user content, brand licensing).
 */
export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        {APP_NAME} is for adults aged 18 and over. By creating an account you confirm you are 18+ and agree to treat other players with respect.
      </p>
      <h2>Your account</h2>
      <p>Keep your login safe. One account per person. We may suspend accounts that harass others, impersonate people, cheat the economy or break the law.</p>
      <h2>Virtual items</h2>
      <p>Glam and Gems are virtual currency with no cash value. Items you buy are a licence to use them in the game, not property.</p>
      <h2>Brands</h2>
      <p>Some brand names are shown as placeholders while licensing is pending. They do not imply endorsement.</p>
      <h2>Content</h2>
      <p>You own what you post and give us a licence to show it in the game. Don’t post anything illegal, hateful, sexual involving minors, or that isn’t yours.</p>
      <h2>Safety</h2>
      <p>Use block and report on any profile, message or voice note. Our moderators review reports.</p>
      <p className="text-sm text-muted-foreground">Draft placeholder. Replace with reviewed terms before launch.</p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we collect</h2>
      <p>Your email (or Google account id), your doll and its appearance, the city you choose (never your exact location), your in-game activity, messages and voice notes you send, and basic device information for analytics and crash reports.</p>
      <h2>Location</h2>
      <p>You choose a country and city. Your globe pin is placed at a random point inside that city. We never request GPS.</p>
      <h2>Messages and voice notes</h2>
      <p>Only the people in a conversation can read it. Voice notes are stored privately and are only accessible to conversation members.</p>
      <h2>Your rights</h2>
      <p>Download everything we hold about you or delete your account at any time from Settings. Deletion removes your doll, crib, posts, chats and progress.</p>
      <p className="text-sm text-muted-foreground">Draft placeholder. Replace with a reviewed policy (NDPR, GDPR, CCPA) before launch.</p>
    </LegalPage>
  )
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between px-4 pt-safe md:px-8 md:pt-6">
        <Logo />
        <Link to="/" className="text-sm font-semibold text-secondary">
          Home
        </Link>
      </header>
      <main className="prose-legal mx-auto flex max-w-2xl flex-col gap-3 px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        {children}
      </main>
    </div>
  )
}
