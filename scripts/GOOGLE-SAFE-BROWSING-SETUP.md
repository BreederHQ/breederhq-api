# Google Safe Browsing API Setup

## What It Does

The Google Safe Browsing API protects against:
- **Phishing sites** - Fake login pages stealing credentials
- **Malware** - Sites distributing viruses/trojans
- **Unwanted software** - Deceptive software downloads
- **Potentially harmful apps** - Dangerous mobile apps

Google maintains a constantly-updated database of billions of unsafe URLs.

## How to Get an API Key (Free)

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "BreederHQ Email Security"
4. Click "Create"

### 2. Enable Safe Browsing API

1. In the Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Safe Browsing API"
3. Click on it
4. Click "Enable"

### 3. Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key (starts with `AIza...`)
4. (Optional) Click "Restrict Key":
   - API restrictions: Select "Safe Browsing API"
   - Application restrictions: Choose "IP addresses" and add your server IPs

### 4. Add to Environment Variables

In Render.com (or your .env file):

```bash
GOOGLE_SAFE_BROWSING_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Usage Limits (Free Tier)

- **10,000 API calls per day** (free forever)
- Each email can check up to 50 URLs
- Calls are cached by Google for 30 minutes

At 10,000 calls/day, you can check 10,000 inbound emails/day for free.

## Testing

Send a test email with a known phishing URL:

```
Subject: Test Email
Body: Check this link: http://testsafebrowsing.appspot.com/s/phishing.html
```

The email should be rejected with error: `malicious_content`

Check Render logs for:
```
Email rejected - malicious URLs detected
threats: ["http://testsafebrowsing.appspot.com/s/phishing.html"]
threatTypes: ["SOCIAL_ENGINEERING"]
```

## What Happens If API Key Not Configured

If `GOOGLE_SAFE_BROWSING_API_KEY` is not set, the system:
- **Allows all emails through** (fail-open)
- Logs a warning
- Still performs other security checks (spam scoring, rate limiting, etc.)

## Cost

**Free tier**: 10,000 lookups/day
**Paid tier**: $0.50 per 1,000 lookups beyond 10,000/day

For a typical breeder business receiving 100-500 emails/day, the free tier is more than sufficient.

## More Info

- [Safe Browsing API Documentation](https://developers.google.com/safe-browsing/v4)
- [Pricing](https://developers.google.com/safe-browsing/v4/usage-limits)
