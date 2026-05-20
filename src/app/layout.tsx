import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { SupabaseProvider } from '@/components/providers/SupabaseProvider'
import { MuiProvider } from '@/components/providers/MuiProvider'
import { NavShell } from '@/components/ui/NavShell'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Debt Snowball',
  description: 'Track and crush your debt with the snowball method',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <MuiProvider>
          <SupabaseProvider>
            <NavShell>
              {children}
            </NavShell>
          </SupabaseProvider>
        </MuiProvider>
      </body>
    </html>
  )
}
