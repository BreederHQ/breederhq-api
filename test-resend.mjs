// Quick Resend API test script
// Run with: node test-resend.mjs
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.dev' });

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log('Testing Resend API...');
  console.log('From:', process.env.RESEND_FROM_EMAIL);
  console.log('');

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: ['delivered@resend.dev'], // Resend test address
      subject: 'Test Email from BreederHQ API - ' + new Date().toLocaleString(),
      html: '<p>This is a test email to verify Resend integration is working.</p><p><strong>Sent at:</strong> ' + new Date().toISOString() + '</p>',
    });

    if (error) {
      console.error('❌ FAILED:', error);
      console.error('');
      console.error('Common causes:');
      console.error('- Invalid API key');
      console.error('- Domain not verified');
      console.error('- Account suspended');
      console.error('- Rate limits exceeded');
      process.exit(1);
    }

    console.log('✅ SUCCESS!');
    console.log('Message ID:', data.id);
    console.log('');
    console.log('Email sent successfully!');
    console.log('Check https://resend.com/emails for delivery status.');
    console.log('Email will be redirected to: dev@breederhq.com (per EMAIL_DEV_REDIRECT)');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
}

testResend();
