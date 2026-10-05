// Email notification system with templates

export type EmailTemplate =
  | "user_invitation"
  | "password_reset"
  | "attendance_warning"
  | "grade_posted"
  | "enrollment_confirmation"
  | "document_shared"
  | "system_alert"
  | "daily_digest";

export interface EmailNotification {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
  isHtml?: boolean;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const EMAIL_TEMPLATES: Record<EmailTemplate, (data: Record<string, any>) => { subject: string; body: string }> = {
  user_invitation: (data) => ({
    subject: `Welcome to ${data.schoolName} - MISDMS`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to MISDMS</h1>
    </div>
    <div class="content">
      <p>Hello ${data.userName},</p>
      <p>Your account has been created in the Management Information System for Deped Schools (MISDMS).</p>
      <p><strong>Login Details:</strong></p>
      <ul>
        <li>Email: ${data.email}</li>
        <li>Role: ${data.role}</li>
        <li>School: ${data.schoolName}</li>
      </ul>
      <p>Please set your password by clicking the button below:</p>
      <a href="${data.loginUrl}" class="button">Set Password</a>
      <p>If you did not request this account, please contact your school administrator.</p>
    </div>
    <div class="footer">
      <p>${data.schoolName} | MISDMS System</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  password_reset: (data) => ({
    subject: "Reset Your MISDMS Password",
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .code { background: #e5e7eb; padding: 15px; border-radius: 5px; font-family: monospace; text-align: center; font-size: 18px; letter-spacing: 2px; margin: 15px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${data.userName},</p>
      <p>We received a request to reset your password. Use the code below or click the button:</p>
      <div class="code">${data.resetCode}</div>
      <p>This code expires in ${data.expirationMinutes} minutes.</p>
      <a href="${data.resetUrl}" class="button">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>MISDMS System | ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  attendance_warning: (data) => ({
    subject: `Attendance Warning - ${data.studentName}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .stats { background: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Attendance Alert</h1>
    </div>
    <div class="content">
      <p>Hello ${data.parentName},</p>
      <p><strong>${data.studentName}</strong>'s attendance for ${data.quarter} is below the recommended threshold.</p>
      <div class="stats">
        <p><strong>Attendance: ${data.attendancePercentage}%</strong></p>
        <p>Present: ${data.presentDays} days | Absent: ${data.absentDays} days | Late: ${data.lateDays} days</p>
      </div>
      <p>Please encourage your child to attend school regularly. Contact the school if there are any issues.</p>
      <a href="${data.schoolWebsite}" class="button">View School Portal</a>
    </div>
    <div class="footer">
      <p>${data.schoolName}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  grade_posted: (data) => ({
    subject: `Grade Posted - ${data.subject}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .grade-box { background: white; padding: 20px; border-radius: 5px; text-align: center; margin: 15px 0; }
    .grade { font-size: 36px; font-weight: bold; color: #10b981; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Grade Posted</h1>
    </div>
    <div class="content">
      <p>Hello ${data.studentName},</p>
      <p>Your grade for <strong>${data.subject}</strong> (${data.quarter}) has been posted.</p>
      <div class="grade-box">
        <p>Your Grade:</p>
        <div class="grade">${data.grade}</div>
        <p>${data.gradeDescription}</p>
      </div>
      <a href="${data.schoolPortal}" class="button">View Full Report</a>
    </div>
    <div class="footer">
      <p>${data.schoolName}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  enrollment_confirmation: (data) => ({
    subject: `Enrollment Confirmation - ${data.schoolName}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .info-box { background: white; padding: 15px; border-left: 4px solid #1e40af; margin: 15px 0; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Enrollment Confirmed</h1>
    </div>
    <div class="content">
      <p>Hello ${data.parentName},</p>
      <p><strong>${data.studentName}</strong> has been successfully enrolled at ${data.schoolName}.</p>
      <div class="info-box">
        <p><strong>Enrollment Details:</strong></p>
        <ul>
          <li>Grade: ${data.gradeLevel}</li>
          <li>Section: ${data.section}</li>
          <li>School Year: ${data.academicYear}</li>
          <li>LRN: ${data.lrn}</li>
        </ul>
      </div>
      <p>Please report to school on ${data.schoolStartDate} with the required documents.</p>
      <a href="${data.schoolWebsite}" class="button">Visit School Website</a>
    </div>
    <div class="footer">
      <p>${data.schoolName}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  document_shared: (data) => ({
    subject: `Document Shared - ${data.documentName}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .doc-box { background: white; padding: 15px; border-left: 4px solid #7c3aed; margin: 15px 0; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Document Shared</h1>
    </div>
    <div class="content">
      <p>Hello ${data.recipientName},</p>
      <p><strong>${data.senderName}</strong> has shared a document with you.</p>
      <div class="doc-box">
        <p><strong>${data.documentName}</strong></p>
        <p>${data.documentDescription || "No description provided"}</p>
      </div>
      <a href="${data.documentUrl}" class="button">View Document</a>
      <p>This document will expire on ${data.expirationDate}.</p>
    </div>
    <div class="footer">
      <p>MISDMS System</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  system_alert: (data) => ({
    subject: `System Alert - ${data.alertType}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .alert-box { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 System Alert</h1>
    </div>
    <div class="content">
      <p>Hello Administrator,</p>
      <div class="alert-box">
        <p><strong>${data.alertType}</strong></p>
        <p>${data.alertMessage}</p>
        <p><strong>Time:</strong> ${data.timestamp}</p>
      </div>
      <p>Please review this alert and take necessary action.</p>
    </div>
    <div class="footer">
      <p>MISDMS System Alert | ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),

  daily_digest: (data) => ({
    subject: `Daily Digest - ${new Date().toLocaleDateString()}`,
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; border-radius: 5px; margin: 20px 0; }
    .section { margin: 20px 0; }
    .section-title { background: #e5e7eb; padding: 10px; font-weight: bold; border-radius: 3px; }
    .item { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    .item:last-child { border-bottom: none; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Daily Digest</h1>
    </div>
    <div class="content">
      <p>Hello ${data.userName},</p>
      <p>Here's your daily summary for ${data.schoolName}:</p>

      <div class="section">
        <div class="section-title">📊 Attendance</div>
        <div class="item">New attendance records: ${data.attendanceCount}</div>
        <div class="item">Students with low attendance: ${data.lowAttendanceCount}</div>
      </div>

      <div class="section">
        <div class="section-title">📝 Grades</div>
        <div class="item">Grades posted: ${data.gradesPostedCount}</div>
        <div class="item">Pending submissions: ${data.pendingSubmissions}</div>
      </div>

      <div class="section">
        <div class="section-title">📚 Enrollments</div>
        <div class="item">New enrollments: ${data.newEnrollments}</div>
        <div class="item">Pending enrollments: ${data.pendingEnrollments}</div>
      </div>

      <a href="${data.schoolPortal}" class="button">View Full Dashboard</a>
    </div>
    <div class="footer">
      <p>${data.schoolName} | ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
    `,
  }),
};

export function getEmailTemplate(template: EmailTemplate, data: Record<string, any>) {
  const templateFn = EMAIL_TEMPLATES[template];
  if (!templateFn) {
    throw new Error(`Unknown email template: ${template}`);
  }
  return templateFn(data);
}

// Email service configuration
const EMAIL_CONFIG = {
  ENABLED: process.env.EMAIL_ENABLED === "true",
  PROVIDER: process.env.EMAIL_PROVIDER || "none", // none, smtp, sendgrid, mailtrap
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  FROM_EMAIL: process.env.EMAIL_FROM || "noreply@school.edu",
  FROM_NAME: process.env.EMAIL_FROM_NAME || "MISDMS",
};

export async function sendEmail(notification: EmailNotification): Promise<EmailResult> {
  try {
    // Get template
    const { subject, body } = getEmailTemplate(notification.template, notification.data);

    // Log email attempt (always happens)
    console.log(`[EMAIL LOG] To: ${notification.to}`);
    console.log(`[EMAIL LOG] Subject: ${subject}`);
    console.log(`[EMAIL LOG] Template: ${notification.template}`);
    console.log(`[EMAIL LOG] Status: ${EMAIL_CONFIG.ENABLED ? "SENDING" : "DISABLED (simulation mode)"}`);

    // If email is disabled, return success but don't actually send
    if (!EMAIL_CONFIG.ENABLED) {
      const messageId = `simulation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[EMAIL LOG] Message ID (simulation): ${messageId}`);
      return {
        success: true,
        messageId,
      };
    }

    // Email is enabled - route to appropriate provider
    switch (EMAIL_CONFIG.PROVIDER) {
      case "smtp":
        return await sendViaSMTP(notification, subject, body);
      case "sendgrid":
        return await sendViaSendGrid(notification, subject, body);
      case "mailtrap":
        return await sendViaSMTP(notification, subject, body);
      default:
        return {
          success: false,
          error: "Email provider not configured",
        };
    }
  } catch (err: any) {
    console.error("Error sending email:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

async function sendViaSMTP(
  notification: EmailNotification,
  subject: string,
  body: string
): Promise<EmailResult> {
  try {
    // Dynamic import of nodemailer
    const nodemailer = await import("nodemailer").catch(() => null);

    if (!nodemailer) {
      return {
        success: false,
        error: "nodemailer not installed. Run: npm install nodemailer",
      };
    }

    const transporter = nodemailer.default.createTransport({
      host: EMAIL_CONFIG.SMTP_HOST,
      port: EMAIL_CONFIG.SMTP_PORT,
      secure: EMAIL_CONFIG.SMTP_PORT === 465,
      auth: {
        user: EMAIL_CONFIG.SMTP_USER,
        pass: EMAIL_CONFIG.SMTP_PASS,
      },
    });

    const result = await transporter.sendMail({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: notification.to,
      subject,
      html: body,
      replyTo: notification.replyTo,
      cc: notification.cc,
      bcc: notification.bcc,
    });

    console.log(`[EMAIL SENT] Via SMTP: ${result.messageId}`);
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err: any) {
    console.error("SMTP send error:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

async function sendViaSendGrid(
  notification: EmailNotification,
  subject: string,
  body: string
): Promise<EmailResult> {
  try {
    const sgMail = await import("@sendgrid/mail").catch(() => null);

    if (!sgMail) {
      return {
        success: false,
        error: "@sendgrid/mail not installed. Run: npm install @sendgrid/mail",
      };
    }

    sgMail.default.setApiKey(EMAIL_CONFIG.SENDGRID_API_KEY!);

    const result = await sgMail.default.send({
      to: notification.to,
      from: EMAIL_CONFIG.FROM_EMAIL,
      subject,
      html: body,
      replyTo: notification.replyTo,
      cc: notification.cc,
      bcc: notification.bcc,
    });

    console.log(`[EMAIL SENT] Via SendGrid: ${result[0].headers["x-message-id"]}`);
    return {
      success: true,
      messageId: result[0].headers["x-message-id"],
    };
  } catch (err: any) {
    console.error("SendGrid send error:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function sendBulkEmails(notifications: EmailNotification[]): Promise<EmailResult[]> {
  return Promise.all(notifications.map((n) => sendEmail(n)));
}
