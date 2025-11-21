import nodemailer from 'nodemailer';

// Create email transporter
const createTransporter = () => {
  // Configure based on your email provider
  // For Gmail, you need to enable "Less secure app access" or use App Passwords
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // e.g., 'gmail', 'outlook', 'yahoo'
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASSWORD, // Your email password or app password
    },
  });

  return transporter;
};

// Send email verification code
export const sendVerificationCode = async (userEmail, userName, verificationCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Legal SahAI" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Verify Your Email - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 48px 32px; text-align: center; }
            .logo-container { margin-bottom: 24px; }
            .logo { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
            .icon-container { margin: 24px 0 16px 0; display: inline-block; }
            .content { background: #ffffff; padding: 48px 40px; }
            .code-box { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 32px 24px; text-align: center; border-radius: 12px; margin: 32px 0; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.2); }
            .code { font-size: 48px; font-weight: 700; letter-spacing: 12px; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; margin: 16px 0; }
            .info-box { background: #eff6ff; padding: 24px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0; }
            .footer { background: #f9fafb; text-align: center; padding: 32px 24px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            ul { padding-left: 24px; margin: 16px 0; }
            li { margin: 10px 0; color: #4b5563; }
            .checkmark { color: #10b981; font-weight: 600; }
            h1 { margin: 0; font-size: 32px; font-weight: 600; line-height: 1.2; }
            h2 { color: #111827; font-size: 20px; font-weight: 600; margin: 24px 0 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
                  <path d="M24 4L4 14L24 24L44 14L24 4Z" fill="white" opacity="0.9"/>
                  <path d="M4 34V14L24 24V44L4 34Z" fill="white" opacity="0.7"/>
                  <path d="M44 34V14L24 24V44L44 34Z" fill="white"/>
                </svg>
              </div>
              <div class="logo">Legal SahAI</div>
              <div class="icon-container">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="12" width="48" height="36" rx="4" stroke="white" stroke-width="3" fill="none"/>
                  <path d="M8 16L32 32L56 16" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1>Verify Your Email Address</h1>
            </div>
            <div class="content">
              <p style="font-size: 18px; color: #111827;">Hello <strong>${userName}</strong>,</p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.7;">Thank you for signing up with Legal SahAI! To complete your registration and secure your account, please verify your email address using the code below:</p>
              
              <div class="code-box">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</div>
                <div class="code">${verificationCode}</div>
                <div style="font-size: 14px; opacity: 0.85; margin-top: 12px;">Enter this code on the verification page</div>
              </div>

              <div class="info-box">
                <strong style="color: #1e40af; font-size: 16px; display: flex; align-items: center;">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px;">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                  </svg>
                  Important Information
                </strong>
                <ul style="margin: 12px 0;">
                  <li>This code is valid for <strong>10 minutes</strong></li>
                  <li>Do not share this code with anyone</li>
                  <li>If you didn't request this code, please ignore this email</li>
                </ul>
              </div>

              <h2>Why verify your email?</h2>
              <ul>
                <li><span class="checkmark">✓</span> Secure your account from unauthorized access</li>
                <li><span class="checkmark">✓</span> Receive important updates and notifications</li>
                <li><span class="checkmark">✓</span> Enable password recovery options</li>
                <li><span class="checkmark">✓</span> Access all Legal SahAI features</li>
              </ul>

              <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280;">
                If you have any questions or need assistance, our support team is here to help.
              </p>

              <p style="margin-top: 24px;">Best regards,<br>
              <strong style="color: #111827;">The Legal SahAI Team</strong></p>
            </div>
            <div class="footer">
              <p style="margin: 8px 0; font-weight: 500;">© ${new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
              <p style="margin: 8px 0;">AI-Powered Legal Assistance Platform</p>
              <p style="margin: 16px 0 8px 0; font-size: 12px; color: #9ca3af;">This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Legal SahAI - Email Verification

Hello ${userName},

Thank you for signing up with Legal SahAI! To complete your registration, please verify your email address using the code below:

Verification Code: ${verificationCode}

This code is valid for 10 minutes. Do not share this code with anyone.

If you didn't request this code, please ignore this email.

Best regards,
The Legal SahAI Team

© ${new Date().getFullYear()} Legal SahAI. All rights reserved.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification code sent to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending verification code:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset code
export const sendPasswordResetCode = async (userEmail, userName, resetCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Legal SahAI" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Password Reset Request - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 48px 32px; text-align: center; }
            .logo-container { margin-bottom: 24px; }
            .logo { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
            .content { background: #ffffff; padding: 48px 40px; }
            .code-box { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 32px 24px; text-align: center; border-radius: 12px; margin: 32px 0; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2); }
            .code { font-size: 48px; font-weight: 700; letter-spacing: 12px; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; margin: 16px 0; }
            .warning-box { background: #fef2f2; padding: 24px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0; }
            .footer { background: #f9fafb; text-align: center; padding: 32px 24px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            ul { padding-left: 24px; margin: 16px 0; }
            li { margin: 10px 0; color: #4b5563; }
            h1 { margin: 0; font-size: 32px; font-weight: 600; line-height: 1.2; }
            h2 { color: #111827; font-size: 20px; font-weight: 600; margin: 24px 0 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
                  <path d="M24 4L4 14L24 24L44 14L24 4Z" fill="white" opacity="0.9"/>
                  <path d="M4 34V14L24 24V44L4 34Z" fill="white" opacity="0.7"/>
                  <path d="M44 34V14L24 24V44L44 34Z" fill="white"/>
                </svg>
              </div>
              <div class="logo">Legal SahAI</div>
              <div style="margin: 24px 0 16px 0;">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="16" y="12" width="32" height="40" rx="4" stroke="white" stroke-width="3" fill="none"/>
                  <circle cx="32" cy="28" r="6" stroke="white" stroke-width="2.5" fill="none"/>
                  <path d="M32 28V20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </div>
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p style="font-size: 18px; color: #111827;">Hello <strong>${userName}</strong>,</p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.7;">We received a request to reset your password. Use the verification code below to proceed with resetting your password:</p>
              
              <div class="code-box">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">Password Reset Code</div>
                <div class="code">${resetCode}</div>
                <div style="font-size: 14px; opacity: 0.85; margin-top: 12px;">Enter this code to reset your password</div>
              </div>

              <div class="warning-box">
                <strong style="color: #991b1b; font-size: 16px; display: flex; align-items: center;">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px;">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  Security Alert
                </strong>
                <ul style="margin: 12px 0;">
                  <li>This code expires in <strong>15 minutes</strong></li>
                  <li><strong>Never share</strong> this code with anyone</li>
                  <li>Legal SahAI will <strong>never ask</strong> for this code via phone or email</li>
                  <li>If you didn't request this, please ignore this email and secure your account</li>
                </ul>
              </div>

              <h2>Didn't request a password reset?</h2>
              <p style="color: #4b5563;">If you didn't initiate this request, your account may be at risk. Please:</p>
              <ul>
                <li>Change your password immediately</li>
                <li>Contact our support team</li>
                <li>Review your recent account activity</li>
              </ul>

              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                For security reasons, this link will expire in 15 minutes. If you need a new code, please request another password reset.
              </p>

              <p>Best regards,<br>
              <strong>The Legal SahAI Security Team</strong></p>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
              <p style="margin: 5px 0;">Secure AI-Powered Legal Assistance</p>
              <p style="margin: 15px 0 5px 0; font-size: 11px; color: #9ca3af;">This is an automated security email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Legal SahAI - Password Reset Request

Hello ${userName},

We received a request to reset your password. Use the verification code below to proceed:

Reset Code: ${resetCode}

IMPORTANT:
- This code expires in 15 minutes
- Never share this code with anyone
- If you didn't request this, contact our support team immediately

Best regards,
The Legal SahAI Security Team

© ${new Date().getFullYear()} Legal SahAI. All rights reserved.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset code sent to ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending password reset code:', error);
    return { success: false, error: error.message };
  }
};

// Send verification approval email
export const sendApprovalEmail = async (lawyerEmail, lawyerName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Legal SahAI" <${process.env.EMAIL_USER}>`,
      to: lawyerEmail,
      subject: 'Lawyer Profile Approved - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 48px 32px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 48px 40px; }
            .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
            .footer { background: #f9fafb; text-align: center; padding: 32px 24px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            ul { padding-left: 24px; margin: 16px 0; }
            li { margin: 10px 0; color: #4b5563; }
            .checkmark { color: #10b981; font-weight: 600; }
            h1 { margin: 16px 0 0 0; font-size: 32px; font-weight: 600; }
            h2 { color: #111827; font-size: 20px; font-weight: 600; margin: 24px 0 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="36" cy="36" r="32" stroke="white" stroke-width="4" fill="none"/>
                <path d="M22 36L32 46L54 24" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h1>Congratulations, ${lawyerName}!</h1>
            </div>
            <div class="content">
              <h2>Your Lawyer Profile Has Been Approved!</h2>
              <p>Great news! Your lawyer profile on Legal SahAI has been successfully verified and approved by our admin team.</p>
              
              <h3>What's Next?</h3>
              <ul>
                <li>✓ Your profile is now visible in the lawyer directory</li>
                <li>✓ You can receive and accept client connection requests</li>
                <li>✓ You can start communicating with clients</li>
                <li>✓ Build your reputation on the platform</li>
              </ul>

              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/home" class="button">
                  Go to Dashboard
                </a>
              </p>

              <p><strong>Tips for Success:</strong></p>
              <ul>
                <li>Respond to client requests promptly</li>
                <li>Maintain professional communication</li>
                <li>Keep your profile information up to date</li>
                <li>Provide quality legal assistance</li>
              </ul>

              <p>If you have any questions or need assistance, feel free to contact our support team.</p>

              <p>Best regards,<br>
              <strong>The Legal SahAI Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Congratulations, ${lawyerName}!

Your lawyer profile on Legal SahAI has been successfully verified and approved by our admin team.

What's Next?
- Your profile is now visible in the lawyer directory
- You can receive and accept client connection requests
- You can start communicating with clients
- Build your reputation on the platform

Visit your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/home

Best regards,
The Legal SahAI Team
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${lawyerEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    return { success: false, error: error.message };
  }
};

// Send verification rejection email
export const sendRejectionEmail = async (lawyerEmail, lawyerName, rejectionReason) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Legal SahAI" <${process.env.EMAIL_USER}>`,
      to: lawyerEmail,
      subject: 'Lawyer Profile Verification Update - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 48px 32px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 48px 40px; }
            .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
            .footer { background: #f9fafb; text-align: center; padding: 32px 24px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            .reason-box { background: #fef2f2; padding: 20px; border-left: 4px solid #ef4444; margin: 24px 0; border-radius: 6px; }
            ul { padding-left: 24px; margin: 16px 0; }
            li { margin: 10px 0; color: #4b5563; }
            h1 { margin: 16px 0 0 0; font-size: 32px; font-weight: 600; }
            h2 { color: #111827; font-size: 20px; font-weight: 600; margin: 24px 0 16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M36 8L64 20L36 32L8 20L36 8Z" stroke="white" stroke-width="4" stroke-linejoin="round" fill="none"/>
                <path d="M8 52V20L36 32V64L8 52Z" stroke="white" stroke-width="4" stroke-linejoin="round" fill="none"/>
                <path d="M64 52V20L36 32V64L64 52Z" stroke="white" stroke-width="4" stroke-linejoin="round" fill="none"/>
              </svg>
              <h1>Profile Verification Update</h1>
            </div>
            <div class="content">
              <p>Dear ${lawyerName},</p>
              
              <p>Thank you for your interest in joining Legal SahAI as a verified lawyer. After careful review, we regret to inform you that your profile verification was not approved at this time.</p>
              
              <div class="reason-box">
                <strong>Reason for Rejection:</strong><br>
                ${rejectionReason}
              </div>

              <h3>What You Can Do:</h3>
              <ul>
                <li>📋 Review the feedback provided above carefully</li>
                <li>📝 Update your credentials or documentation</li>
                <li>💬 Contact our support team for clarification if needed</li>
                <li>⏰ Wait for the 7-day reapplication period</li>
                <li>🔄 Resubmit your application after addressing the concerns</li>
              </ul>

              <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b;">
                <strong>Note:</strong> There is a 7-day waiting period before you can reapply. This gives you time to address the feedback and gather any necessary documentation.
              </p>

              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboard-lawyer" class="button">
                  View Application Status
                </a>
              </p>

              <p>We appreciate your understanding and look forward to reviewing your updated application in the future.</p>

              <p>If you have any questions, please don't hesitate to reach out to our support team.</p>

              <p>Best regards,<br>
              <strong>The Legal SahAI Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${lawyerName},

Thank you for your interest in joining Legal SahAI as a verified lawyer. After careful review, we regret to inform you that your profile verification was not approved at this time.

Reason for Rejection:
${rejectionReason}

What You Can Do:
- Review the feedback provided above carefully
- Update your credentials or documentation
- Contact our support team for clarification if needed
- Wait for the 7-day reapplication period
- Resubmit your application after addressing the concerns

Note: There is a 7-day waiting period before you can reapply.

View your application status: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboard-lawyer

Best regards,
The Legal SahAI Team
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Rejection email sent to ${lawyerEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    return { success: false, error: error.message };
  }
};
