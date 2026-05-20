'use client';

import { useSupabase } from '@/components/providers/SupabaseProvider';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Logo from '../../../../public/debtTracker.png';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function LoginPage() {
  const { supabase } = useSupabase();
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: `
        radial-gradient(ellipse 700px 500px at 50% -5%, rgba(91,95,245,0.18) 0%, transparent 65%),
        radial-gradient(ellipse 400px 300px at 80% 90%, rgba(15,214,124,0.07) 0%, transparent 60%),
        var(--background)
      `,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
        }}
      >
        {/* Logo + title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
            textAlign: 'center',
          }}
        >
          <Image
            src={Logo}
            alt="Debt Tracker"
            width={124}
            height={124}
            style={{ borderRadius: '26px' }}
          />
          <div>
            <Typography
              style={{
                fontSize: '40px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-1px',
                lineHeight: 1.15,
              }}
            >
              Debt Tracker
            </Typography>
            <Typography
              style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                marginTop: '8px',
                letterSpacing: '0.01em',
              }}
            >
              Visualize your path to financial freedom
            </Typography>
          </div>
        </div>

        {/* Card */}
        <Card
          style={{
            width: '100%',
            background: 'rgba(28, 32, 48, 0.9)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <CardContent
            style={{
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {authError && (
              <Alert severity="error">
                Authentication failed. Please try again.
              </Alert>
            )}

            <Typography
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                lineHeight: 1.65,
              }}
            >
              Sign in to track your loans and share progress with your family.
            </Typography>

            <Button
              variant="outlined"
              color="inherit"
              fullWidth
              onClick={handleGoogleLogin}
              startIcon={<GoogleIcon />}
              style={{
                justifyContent: 'center',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: 500,
                borderColor: 'rgba(255,255,255,0.12)',
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              Continue with Google
            </Button>

            <Typography
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                lineHeight: 1.6,
                opacity: 0.7,
              }}
            >
              Your data is private. Family groups require an invite.
            </Typography>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
