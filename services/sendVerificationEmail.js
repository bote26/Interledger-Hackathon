const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Generates a verification token object
 * @returns {{token:string, expires:Date}}
 */
function generateEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, expires };
}

/**
 * Send a verification email to the user.
 * @param {{id:string,email:string}} user
 * @param {string} token
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(user, token) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER or EMAIL_PASS not set; skipping email send.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: `Open Payments App <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Verify your email address',
    html: `
      <p>Hello ${user.email},</p>
      <p>Thanks for registering. Please verify your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>This link expires in 1 hour. If you did not register, you can ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', user.email);
  } catch (err) {
    console.error('Error sending verification email:', err.message);
  }
}

module.exports = { sendVerificationEmail, generateEmailVerificationToken };
