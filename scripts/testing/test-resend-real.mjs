// Test email to real address
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.dev' });

const resend = new Resend(process.env.RESEND_API_KEY);
const recipientEmail = process.env.EMAIL_DEV_REDIRECT || 'dev@breederhq.com';

async function testResend() {
  console.log('Testing Resend API with real delivery...');
  console.log('From:', process.env.RESEND_FROM_EMAIL);
  console.log('To:', recipientEmail);
  console.log('');

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [recipientEmail],
      subject: 'Test Email - ' + new Date().toLocaleString(),
      html: `
        <h1>BreederHQ Email Test</h1>
        <p>This is a test email sent directly via Resend API.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>From domain:</strong> ${process.env.RESEND_FROM_EMAIL}</p>
        <p><strong>To:</strong> ${recipientEmail}</p>
      `,
    });

    if (error) {
      console.error('❌ FAILED:', error);
      process.exit(1);
    }

    console.log('✅ SUCCESS!');
    console.log('Message ID:', data.id);
    console.log('');
    console.log('Email sent to:', recipientEmail);
    console.log('Check https://resend.com/emails for delivery status.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
}

testResend();
