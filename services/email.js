const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // Use environment variables for email configuration
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send welcome email to new user
const sendWelcomeEmail = async (user) => {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"AI SDR" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Welcome to AI SDR - Your AI-Powered Sales Assistant',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Welcome to AI SDR! 🎉</h1>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>Thank you for signing up! Your AI-powered sales development representative is now ready to help you find high-intent leads.</p>
          
          <h3>What happens next?</h3>
          <ul>
            <li>Our AI scans Hacker News, Reddit, Upwork, and more for leads matching your keywords</li>
            <li>New leads appear in your dashboard within 24 hours</li>
            <li>You'll receive a daily digest of new leads</li>
          </ul>
          
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/profile" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Customize Your Keywords
            </a>
          </p>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            You're currently on the Free plan with 50 leads/month. 
            <a href="${process.env.FRONTEND_URL}/billing">Upgrade anytime</a> for more leads.
          </p>
        </div>
      `
    });
    
    console.log(`✅ Welcome email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send daily digest with new leads
const sendDailyDigest = async (user, newLeads) => {
  try {
    if (!newLeads || newLeads.length === 0) return { success: true, skipped: true };
    
    const transporter = createTransporter();
    
    const leadsHtml = newLeads.slice(0, 5).map(lead => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="margin: 0; color: #1e293b;">${lead.companyName || 'Unknown Company'}</h4>
          <span style="background: ${lead.score === 'hot' ? '#fee2e2' : lead.score === 'warm' ? '#fef3c7' : '#e0f2fe'}; 
                       color: ${lead.score === 'hot' ? '#dc2626' : lead.score === 'warm' ? '#d97706' : '#0369a1'};
                       padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${lead.score}
          </span>
        </div>
        <p style="color: #64748b; font-size: 14px; margin: 8px 0;">${lead.intent?.substring(0, 100)}...</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">Source: ${lead.source}</p>
      </div>
    `).join('');
    
    await transporter.sendMail({
      from: `"AI SDR" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `🎯 ${newLeads.length} New Leads Found Today`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Your Daily Lead Digest</h1>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>We found <strong>${newLeads.length} new leads</strong> matching your keywords today.</p>
          
          <h3>Top Leads:</h3>
          ${leadsHtml}
          
          ${newLeads.length > 5 ? `<p style="color: #64748b;">+ ${newLeads.length - 5} more leads...</p>` : ''}
          
          <p style="margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View All Leads
            </a>
          </p>
          
          <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
            You're receiving this because you enabled daily digest emails. 
            <a href="${process.env.FRONTEND_URL}/profile">Manage preferences</a>
          </p>
        </div>
      `
    });
    
    console.log(`✅ Daily digest sent to ${user.email} (${newLeads.length} leads)`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send daily digest:', error);
    return { success: false, error: error.message };
  }
};

// Send payment confirmation email
const sendPaymentConfirmation = async (user, planDetails) => {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"AI SDR" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Payment Confirmed - Welcome to ' + planDetails.name,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10b981;">Payment Confirmed! 🎉</h1>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>Thank you for upgrading to the <strong>${planDetails.name}</strong> plan!</p>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Plan Details:</h3>
            <ul style="margin: 0;">
              <li>Plan: ${planDetails.name}</li>
              <li>Leads per month: ${planDetails.leads}</li>
              <li>Amount: $${planDetails.price}/${planDetails.period}</li>
            </ul>
          </div>
          
          <p>Your upgraded limits are now active. You can manage your subscription anytime from your billing page.</p>
          
          <p style="margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL}/billing" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Manage Subscription
            </a>
          </p>
        </div>
      `
    });
    
    console.log(`✅ Payment confirmation sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send payment confirmation:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: `"AI SDR" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e293b;">Reset Your Password</h1>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          
          <p style="color: #64748b; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
          
          <p style="color: #94a3b8; font-size: 12px;">
            Or copy and paste this URL: ${resetUrl}
          </p>
        </div>
      `
    });
    
    console.log(`✅ Password reset email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send lead notification (for high-priority leads)
const sendLeadNotification = async (user, lead) => {
  try {
    if (lead.score !== 'hot') return { success: true, skipped: true };
    
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"AI SDR" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: '🔥 Hot Lead Alert!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">🔥 Hot Lead Alert!</h1>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>We found a high-intent lead that matches your criteria:</p>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc2626;">${lead.companyName || 'Unknown Company'}</h3>
            <p style="color: #7f1d1d; margin: 10px 0;">${lead.intent}</p>
            <p style="color: #991b1b; font-size: 12px; margin: 0;">
              Source: ${lead.source} | Score: HOT
            </p>
          </div>
          
          <p style="margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL}/leads/${lead.id}" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Lead Details
            </a>
          </p>
        </div>
      `
    });
    
    console.log(`✅ Hot lead notification sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send lead notification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendDailyDigest,
  sendPaymentConfirmation,
  sendPasswordResetEmail,
  sendLeadNotification
};
