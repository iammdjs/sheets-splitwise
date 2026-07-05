import React, { useState } from 'react';
import { DollarSign, Shield, Users, Layers, AlertCircle } from 'lucide-react';

export default function Login({ clientId, onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      setError('Google Client ID is not configured. Please create a .env file and set VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Initialize the OAuth2 token client
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setError(`Authentication failed: ${tokenResponse.error_description || tokenResponse.error}`);
            setLoading(false);
            return;
          }

          if (tokenResponse.access_token) {
            try {
              // Fetch user profile info using the access token
              const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              
              if (!userInfoResponse.ok) {
                throw new Error('Failed to fetch user profile info.');
              }

              const userInfo = await userInfoResponse.json();
              
              onLoginSuccess({
                token: tokenResponse.access_token,
                expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
                user: {
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture
                }
              });
            } catch (err) {
              setError('Failed to fetch user profile. Please try again.');
              setLoading(false);
            }
          }
        },
        error_callback: (err) => {
          setError(`OAuth client initialization failed: ${err.message}`);
          setLoading(false);
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      setError('Google Identity Services script not loaded. Please refresh the page or disable adblockers.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="app-logo">
          <DollarSign size={36} />
        </div>
        <h1>Sheets Splitwise</h1>
        <p className="login-tagline">Split expenses, not friendships. Backed by Google Sheets.</p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '1rem',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--danger-color)',
            fontSize: '0.85rem',
            textAlign: 'left',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Configuration Warning:</strong>
              <p style={{ marginTop: '0.25rem' }}>{error}</p>
            </div>
          </div>
        )}

        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon-wrapper"><Shield size={20} /></span>
            <div>
              <strong>100% Privacy & Control</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All data is stored directly in your own Google Sheet. No databases.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon-wrapper"><Users size={20} /></span>
            <div>
              <strong>Easy Roommate Collaboration</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Share access via email directly in the app. Friends can log in and split too.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon-wrapper"><Layers size={20} /></span>
            <div>
              <strong>Automatic Debt Simplification</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>The app calculates who owes whom and resolves debts in minimal transactions.</p>
            </div>
          </div>
        </div>

        <div className="google-btn-wrapper">
          <button 
            className="custom-google-btn" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderLeftColor: 'black' }} />
            ) : (
              <>
                <svg className="google-logo" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
