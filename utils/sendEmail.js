import nodemailer from 'nodemailer';

const sendEmail = async options => {
  // Create reusable transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: process.env.EMAIL_SERVER_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD
    }
  });

  // Define email options
  const message = {
    from: `${process.env.FROM_NAME || 'EGAM Agency CRM'} <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  // Send email
  const info = await transporter.sendMail(message);

  console.log('Message sent: %s', info.messageId);
};

export default sendEmail;
