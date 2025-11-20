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
      subject: '🔐 Verify Your Email - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .content { background: #ffffff; padding: 40px 30px; }
            .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 15px; margin: 30px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
            .code { font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 10px 0; }
            .info-box { background: #f0f4ff; padding: 20px; border-radius: 10px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { background: #f9fafb; text-align: center; padding: 30px 20px; color: #6b7280; font-size: 13px; }
            .icon { font-size: 48px; margin-bottom: 15px; }
            .warning { color: #ef4444; font-weight: 600; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⚖️ Legal SahAI</div>
              <div class="icon">✉️</div>
              <h1 style="margin: 0; font-size: 28px;">Verify Your Email Address</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
              
              <p>Thank you for signing up with Legal SahAI! To complete your registration and secure your account, please verify your email address using the code below:</p>
              
              <div class="code-box">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px;">Your Verification Code</div>
                <div class="code">${verificationCode}</div>
                <div style="font-size: 13px; opacity: 0.8; margin-top: 10px;">Enter this code on the verification page</div>
              </div>

              <div class="info-box">
                <strong>⏰ Important:</strong>
                <ul style="margin: 10px 0;">
                  <li>This code is valid for <strong>10 minutes</strong></li>
                  <li>Do not share this code with anyone</li>
                  <li>If you didn't request this code, please ignore this email</li>
                </ul>
              </div>

              <p><strong>Why verify your email?</strong></p>
              <ul>
                <li>✅ Secure your account from unauthorized access</li>
                <li>✅ Receive important updates and notifications</li>
                <li>✅ Enable password recovery options</li>
                <li>✅ Access all Legal SahAI features</li>
              </ul>

              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                If you have any questions or need assistance, our support team is here to help.
              </p>

              <p>Best regards,<br>
              <strong>The Legal SahAI Team</strong></p>
            </div>
            <div class="footer">
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} Legal SahAI. All rights reserved.</p>
              <p style="margin: 5px 0;">AI-Powered Legal Assistance Platform</p>
              <p style="margin: 15px 0 5px 0; font-size: 11px; color: #9ca3af;">This is an automated email. Please do not reply to this message.</p>
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
      subject: '🔒 Password Reset Request - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 20px; text-align: center; }
            .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .content { background: #ffffff; padding: 40px 30px; }
            .code-box { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 15px; margin: 30px 0; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
            .code { font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 10px 0; }
            .warning-box { background: #fef2f2; padding: 20px; border-radius: 10px; border-left: 4px solid #ef4444; margin: 20px 0; }
            .footer { background: #f9fafb; text-align: center; padding: 30px 20px; color: #6b7280; font-size: 13px; }
            .icon { font-size: 48px; margin-bottom: 15px; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⚖️ Legal SahAI</div>
              <div class="icon">🔐</div>
              <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
              
              <p>We received a request to reset your password. Use the verification code below to proceed with resetting your password:</p>
              
              <div class="code-box">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px;">Password Reset Code</div>
                <div class="code">${resetCode}</div>
                <div style="font-size: 13px; opacity: 0.8; margin-top: 10px;">Enter this code to reset your password</div>
              </div>

              <div class="warning-box">
                <strong>⚠️ Security Alert:</strong>
                <ul style="margin: 10px 0;">
                  <li>This code expires in <strong>15 minutes</strong></li>
                  <li><strong>Never share</strong> this code with anyone</li>
                  <li>Legal SahAI will <strong>never ask</strong> for this code via phone or email</li>
                  <li>If you didn't request this, please ignore this email and secure your account</li>
                </ul>
              </div>

              <p><strong>Didn't request a password reset?</strong></p>
              <p>If you didn't initiate this request, your account may be at risk. Please:</p>
              <ul>
                <li>🔒 Change your password immediately</li>
                <li>📧 Contact our support team</li>
                <li>✅ Review your recent account activity</li>
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
      subject: '🎉 Lawyer Profile Approved - Legal SahAI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .success-icon { font-size: 48px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
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
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .alert-icon { font-size: 48px; margin-bottom: 10px; }
            .reason-box { background: white; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="alert-icon">⚠️</div>
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
