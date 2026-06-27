const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('--- SMTP Diagnostic Tool ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('FROM_EMAIL:', process.env.FROM_EMAIL);

const secure = process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587', 10) === 465;
console.log('Calculated secure option:', secure);

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

console.log('\nVerifying transporter connection...');
mailTransporter.verify((error, success) => {
  if (error) {
    console.error('❌ Connection verification failed:', error);
  } else {
    console.log('✅ Server is ready to take our messages!');
    
    // Attempt to send a test mail
    const fromEmail = process.env.FROM_EMAIL || 'eazziogroup@gmail.com';
    const mailOptions = {
      from: `"Eazzio Support Test" <${fromEmail}>`,
      to: fromEmail, // Send to self
      subject: 'Eazzio SMTP Test Mail',
      text: 'This is a test email sent from the Eazzio SMTP diagnostic script.'
    };
    
    console.log('\nSending test email to', fromEmail, '...');
    mailTransporter.sendMail(mailOptions)
      .then(info => {
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Envelope:', info.envelope);
        console.log('Response:', info.response);
      })
      .catch(err => {
        console.error('❌ Failed to send email:', err);
      });
  }
});
