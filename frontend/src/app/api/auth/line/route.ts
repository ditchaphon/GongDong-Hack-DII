import { NextRequest, NextResponse } from 'next/server';

/**
 * LINE ID Token Verification Endpoint
 * Validates the ID token issued by LIFF with LINE's OAuth2 verify endpoint,
 * then maps or creates the user session in the database.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    // 1. Mock mode handling for local development
    if (
      process.env.NEXT_PUBLIC_LIFF_MOCK === 'true' ||
      idToken.startsWith('mock_')
    ) {
      return NextResponse.json({
        success: true,
        isMock: true,
        user: {
          id: 'usr_mock_01',
          lineUserId: 'U1234567890abcdef',
          displayName: 'Sky Cautious',
          pictureUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          isSeller: true,
          credits: 5,
        },
      });
    }

    // 2. Real verification with LINE API
    const channelId = process.env.NEXT_PUBLIC_LIFF_ID?.split('-')[0];
    const verifyParams = new URLSearchParams({
      id_token: idToken,
      client_id: channelId || '',
    });

    const lineResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });

    if (!lineResponse.ok) {
      const errDetail = await lineResponse.text();
      return NextResponse.json(
        { error: 'Invalid LINE ID token', detail: errDetail },
        { status: 401 }
      );
    }

    const payload = await lineResponse.json();
    // payload contains: sub (line userId), name, picture, email, etc.

    // 3. TODO: Supabase integration
    // - Check if user exists in public.users table where line_user_id = payload.sub
    // - If not, insert new record with 1 free credit: credits = 1
    // - Issue secure HTTP-only session cookie or JWT for API calls

    return NextResponse.json({
      success: true,
      user: {
        lineUserId: payload.sub,
        displayName: payload.name,
        pictureUrl: payload.picture,
        credits: 1, // Default free credit for newly verified users
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/line:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

