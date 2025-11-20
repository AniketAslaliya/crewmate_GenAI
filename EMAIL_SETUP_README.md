# Email Configuration Guide

This guide explains how to set up email notifications for lawyer verification approvals and rejections.

## Environment Variables

Add the following variables to your `.env` file:

```env
# Email Service Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Setup Instructions

### For Gmail:

1. **Enable 2-Step Verification** (if not already enabled):
   - Go to your Google Account settings
   - Navigate to Security > 2-Step Verification
   - Follow the setup instructions

2. **Generate App Password**:
   - Go to Google Account > Security
   - Under "Signing in to Google," select "App Passwords"
   - Select app: "Mail"
   - Select device: "Other (Custom name)" - enter "Legal SahAI"
   - Click "Generate"
   - Copy the 16-character password (without spaces)
   - Use this as `EMAIL_PASSWORD` in your `.env` file

3. **Update .env file**:
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   ```

### For Other Email Providers:

#### Outlook/Hotmail:
```env
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

#### Yahoo:
```env
EMAIL_SERVICE=yahoo
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-password
```

#### Custom SMTP Server:
```env
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
```

If using custom SMTP, update `backend/utils/emailService.js`:
```javascript
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
```

## Email Templates

### Approval Email Features:
- ✅ Success icon and congratulations message
- 📋 List of what lawyer can now do
- 🔗 Direct link to dashboard
- 💡 Tips for success
- 📧 Professional HTML design with fallback text version

### Rejection Email Features:
- ⚠️ Clear explanation of rejection
- 📝 Admin feedback/reason displayed
- 🔄 Reapplication instructions
- ⏰ 7-day freeze period notice
- 🔗 Link to view application status
- 💬 Support contact information

## Testing Email Functionality

### Test in Development:

1. **Install required package** (already included):
   ```bash
   npm install nodemailer
   ```

2. **Restart your backend server**:
   ```bash
   npm start
   ```

3. **Test by approving/rejecting a lawyer** through the admin panel

4. **Check console logs** for email status:
   - `✅ Approval email sent to lawyer@example.com`
   - `❌ Error sending email: [error details]`

### Common Issues:

**Gmail "Less secure app" error:**
- Solution: Use App Passwords (see setup instructions above)

**Connection refused error:**
- Check if EMAIL_SERVICE is correct
- Verify EMAIL_USER and EMAIL_PASSWORD are set
- Check your firewall/antivirus settings

**Email not received:**
- Check spam/junk folder
- Verify email address is correct in lawyer profile
- Check console logs for sending status

## Production Recommendations

### 1. Use Professional Email Service:
Consider using dedicated email services for production:
- **SendGrid**: Free tier available, reliable delivery
- **AWS SES**: Pay-as-you-go, highly scalable
- **Mailgun**: Developer-friendly, good documentation
- **Postmark**: Transactional email specialist

### 2. Implement Email Queue:
For high volume, use a queue system:
```bash
npm install bull redis
```

### 3. Add Email Logging:
Store email send status in database for tracking

### 4. Email Templates Management:
Consider using template engines like Handlebars for easier maintenance

### 5. Monitor Email Delivery:
- Track bounce rates
- Monitor spam complaints
- Set up webhook for delivery status

## Security Best Practices

1. **Never commit credentials**:
   - Keep `.env` in `.gitignore`
   - Use environment variables in production

2. **Use App Passwords**:
   - Never use your main account password
   - Generate separate passwords for each app

3. **Rotate credentials regularly**:
   - Update passwords every 3-6 months
   - Revoke unused app passwords

4. **Limit email rate**:
   - Implement rate limiting to prevent abuse
   - Add delay between emails if needed

## Customization

To customize email templates, edit `backend/utils/emailService.js`:

1. **Change colors/styling**: Modify the CSS in `<style>` section
2. **Update content**: Edit the HTML/text content
3. **Add more information**: Include additional lawyer details
4. **Change sender name**: Modify the `from` field

## Support

If you encounter issues:
1. Check console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple email first
4. Ensure internet connection is stable
5. Check email provider's documentation

## Example Production .env

```env
# Database
MONGO_URI=your-production-mongodb-uri

# Email (Production)
EMAIL_SERVICE=gmail
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=your-secure-app-password

# URLs
FRONTEND_URL=https://yourdomain.com
CLIENT_URL=https://api.yourdomain.com

# Other configs...
```
