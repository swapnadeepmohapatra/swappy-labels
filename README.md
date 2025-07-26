# Swappy Labels

A web application that automatically classifies and labels your Gmail inbox using AI. The app connects to your Gmail account, reads unread emails, classifies them using Google's Gemini AI, and applies appropriate labels.

## Features

- 🔐 **Google OAuth 2.0 Authentication** - Secure Gmail account connection
- 🤖 **AI-Powered Classification** - Uses Gemini AI to classify emails into categories
- 🏷️ **Automatic Labeling** - Creates and applies Gmail labels automatically
- 📧 **Batch Processing** - Processes up to 10 unread emails at once
- 🔄 **Retry Logic** - Handles API failures with automatic retries
- 📱 **Modern UI** - Clean, responsive interface with real-time feedback

## Email Categories

The app classifies emails into the following categories:

- **Work** - Professional and work-related emails
- **Personal** - Personal communications
- **Finance** - Banking, bills, and financial matters
- **Promotions** - Marketing and promotional content
- **Travel** - Travel bookings and itineraries
- **Spam** - Unwanted or suspicious emails

## Prerequisites

Before running this application, you'll need:

1. **Google Cloud Project** with the following APIs enabled:

   - Gmail API
   - Google Generative AI API

2. **OAuth 2.0 Credentials** for Gmail API access

3. **Gemini API Key** for AI classification

## Setup Instructions

### 1. Google Cloud Project Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Generative AI API

### 2. Create OAuth 2.0 Credentials

1. In the Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Add the following redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for development)
   - `https://yourdomain.com/api/auth/callback` (for production)
5. Note down your Client ID and Client Secret

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### 4. Environment Configuration

1. Copy the `.env.local` file and fill in your credentials:

```bash
# Gmail API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. **Connect Gmail Account**: Click "Connect Gmail Account" and authorize the application
2. **Label Inbox**: Click "Label My Inbox" to process your unread emails
3. **View Results**: See the classification results and any errors in real-time

## How It Works

1. **Authentication**: Uses OAuth 2.0 to securely access your Gmail account
2. **Email Fetching**: Retrieves the latest 10 unread emails from your inbox
3. **AI Classification**: Sends each email subject to Gemini AI for classification
4. **Label Management**: Creates Gmail labels if they don't exist
5. **Email Processing**: Applies labels and marks emails as read
6. **Error Handling**: Retries failed API calls and provides user feedback

## Security Features

- OAuth 2.0 authentication with secure token storage
- Environment variable configuration for sensitive data
- HTTP-only cookies for token storage
- Proper error handling and user feedback

## Development

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── route.ts          # OAuth initiation
│   │   │   ├── callback/
│   │   │   │   └── route.ts      # OAuth callback
│   │   │   └── check/
│   │   │       └── route.ts      # Auth status check
│   │   └── gmail/
│   │       └── route.ts          # Gmail processing
│   ├── page.tsx                  # Main UI component
│   └── layout.tsx                # App layout
```

### Key Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling and responsive design
- **Google APIs** - Gmail and Gemini AI integration
- **OAuth 2.0** - Secure authentication

## Troubleshooting

### Common Issues

1. **"Not authenticated" error**: Make sure you've completed the OAuth flow
2. **"Failed to process emails"**: Check your Gmail API quotas and permissions
3. **"Gemini API error"**: Verify your Gemini API key is correct and has sufficient quota

### API Quotas

- Gmail API: 1,000,000,000 queries per day
- Gemini API: Varies by model and region

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
