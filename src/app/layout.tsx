import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { SupabaseProvider } from '@/components/providers/SupabaseProvider'
import { FamilyProvider } from '@/components/providers/FamilyProvider'
import { MuiProvider } from '@/components/providers/MuiProvider'
import { NavShell } from '@/components/ui/NavShell'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Family Portal',
  description: 'Shared tools for family finances, meals, media, and household projects',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <SupabaseProvider>
          <FamilyProvider>
            <MuiProvider>
              <NavShell>
                {children}
              </NavShell>
            </MuiProvider>
          </FamilyProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
