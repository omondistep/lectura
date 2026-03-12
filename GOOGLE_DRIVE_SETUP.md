# Google Drive Setup for Lectura

Connect your Google Drive to Lectura without needing JSON files. Just set two environment variables!

## Quick Setup (2 minutes)

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Desktop application**
6. Copy your **Client ID** and **Client Secret**

### 2. Set Environment Variables

**Linux/macOS:**
```bash
export GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

**Windows (Command Prompt):**
```cmd
set GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
set GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### 3. Start Lectura

```bash
npm start
```

### 4. Connect Google Drive

1. In Lectura, click the **More Actions** button (⋮)
2. Select **Browse Google Drive**
3. Click **Connect Google Drive**
4. Sign in with your Gmail account
5. Grant permissions
6. Done! Your Google Drive is now connected

## Persistent Setup

To make environment variables permanent:

**Linux/macOS (.bashrc or .zshrc):**
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

**Windows (System Environment Variables):**
1. Press `Win + X` → **System**
2. **Advanced system settings** → **Environment Variables**
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
4. Restart your terminal

## Troubleshooting

**"Google OAuth credentials not configured"**
- Make sure both environment variables are set
- Restart Lectura after setting variables

**"Invalid client"**
- Check that Client ID and Secret are correct
- Make sure Google Drive API is enabled in Cloud Console

**"Redirect URI mismatch"**
- In Google Cloud Console, add `http://localhost:8000/gdrive/callback` to authorized redirect URIs

## Security Notes

- Never commit credentials to version control
- Use environment variables, not hardcoded values
- Credentials are stored locally in `gdrive_token.json`
- You can revoke access anytime in Google Account settings
