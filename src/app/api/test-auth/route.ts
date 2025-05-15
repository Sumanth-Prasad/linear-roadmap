import { NextResponse } from 'next/server';

export async function GET() {
  // Return environment variables and configuration data (without secrets)
  return NextResponse.json({
    environment: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'not set',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      LINEAR_CLIENT_ID_CHECK: process.env.LINEAR_CLIENT_ID ? 'set' : 'not set',
      GOOGLE_CLIENT_ID_CHECK: process.env.GOOGLE_CLIENT_ID ? 'set' : 'not set',
    },
    callbackUrls: {
      linear: `${process.env.NEXTAUTH_URL || 'https://linear-roadmap-next.vercel.app'}/api/auth/callback/linear`,
      google: `${process.env.NEXTAUTH_URL || 'https://linear-roadmap-next.vercel.app'}/api/auth/callback/google`,
    }
  });
} 