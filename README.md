# Sheets Splitwise 💸

A modern, serverless, privacy-first Splitwise clone that uses **Google Sheets as its database**.

All data is stored directly in your own Google Drive (via private spreadsheets), giving you 100% ownership and privacy over your group expenses. No custom backends, no databases, and no login forms—just simple Google OAuth.

---

## Key Features
- **Privacy First:** Your expense data never touches a third-party server. It is saved directly in your Google Sheets.
- **Dynamic Currencies:** Choose your local currency (INR `₹`, USD `$`, EUR `€`, GBP `£`, etc.) at the time of group creation.
- **Dynamic Balanced Splits:** Support for splitting expenses equally or by exact custom amounts.
- **One-Click Settle Up:** Record payments between members instantly to balance the books.
- **Drive Metadata Indexing:** Auto-discovers Splitwise spreadsheets created by the app in your Google Drive using private `appProperties` tags.
- **Fully Responsive:** Sleek desktop and mobile drawer-based layouts built with glassmorphic CSS.

---

## 🛠️ Google Cloud Console Setup Guide

To run this application, you must register a project in the Google Cloud Console to enable Google Sign-In and authorize Sheets/Drive API access.

### 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. Click on the project dropdown at the top left and click **New Project**.
4. Enter a project name (e.g., `Sheets Splitwise`) and click **Create**.

### 2. Enable APIs
You need to enable both the Google Drive API and the Google Sheets API:
1. Search for **Google Drive API** in the top search bar, click on it, and click **Enable**.
2. Search for **Google Sheets API** in the top search bar, click on it, and click **Enable**.

### 3. Configure OAuth Consent Screen
1. In the left sidebar, navigate to **APIs & Services** > **OAuth consent screen**.
2. Select **User Type** as **External** and click **Create**.
3. Fill in the **App Information**:
   - **App name:** `Sheets Splitwise`
   - **User support email:** Select your Gmail address.
   - **Developer contact information:** Enter your email address.
4. Click **Save and Continue**.
5. **Scopes Section:**
   - Click **Add or Remove Scopes**.
   - Search for and select the following scopes:
     - `.../auth/userinfo.profile` (To view your name & profile picture)
     - `.../auth/userinfo.email` (To view your email address)
     - `.../auth/drive.file` (Crucial: Allows the app to create and edit *only* the specific spreadsheets it opens/creates)
   - Click **Update** and then **Save and Continue**.
6. **Test Users Section:**
   - Under **Test users**, click **Add Users**.
   - Enter your email address (and the email addresses of friends you want to test with). *Note: While in "Testing" mode, only registered test users can sign in.*
   - Click **Save and Continue**.

### 4. Create Credentials (OAuth Client ID)
1. In the left sidebar, navigate to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** at the top and select **OAuth client ID**.
3. Select **Application type** as **Web application**.
4. Name it (e.g., `Splitwise Web Client`).
5. Under **Authorized JavaScript origins**, click **Add URI** and enter:
   - `http://localhost:5173` (for local development)
   - *If you deploy your app, add your production URL here too (e.g., `https://your-app.vercel.app`).*
6. Under **Authorized redirect URIs**, click **Add URI** and enter:
   - `http://localhost:5173`
   - *Add your production URL here as well.*
7. Click **Create**.
8. Copy the **Client ID** from the popup modal. You will need this for your environment variables.

---

## 🚀 Getting Started Locally

### 1. Clone the Repository
```bash
git clone https://github.com/iammdjs/sheets-splitwise.git
cd sheets-splitwise
```

### 2. Configure Environment Variables
Create a file named `.env` in the root of the project:
```bash
touch .env
```
Add the following line, replacing `YOUR_CLIENT_ID` with the Client ID you copied from the Google Cloud Console:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`. Click **Sign in with Google** to begin creating expense groups!

---

## 📂 Spreadsheet Schema (Database Structure)

The app automatically sets up the following structure inside newly created spreadsheets. You can open the sheets manually in Google Sheets at any time to verify your data:

1. **`Group_Config` Tab:** Stores meta settings (Group Name, Currency Code, Created Time).
2. **`Members` Tab:** Tracks active group members (Email, Name, Added Time).
3. **`Expenses` Tab:** Logging transactions (ID, Description, Amount, Paid By, Split Type, Split Details, Date, Category, Created By).

---

## ⚡ Deployment

To deploy this project to **Vercel** or **Netlify**:
1. Connect your GitHub repository to Vercel/Netlify.
2. In the deployment settings, add the environment variable:
   - Key: `VITE_GOOGLE_CLIENT_ID`
   - Value: `[Your Google Client ID]`
3. Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Crucial:** Go back to your [Google Cloud Console Credentials page](https://console.cloud.google.com/apis/credentials) and add your deployed app URL to the **Authorized JavaScript origins** and **Authorized redirect URIs** list.
