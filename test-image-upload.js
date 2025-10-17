const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// Generate a test token for alice@test.com (from test data)
function generateTestToken() {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    {
      userId: 'cmgur9nhb012hpa8sfpgypykd', // Alice's ID from test data
      email: 'alice@test.com'
    },
    secret,
    { expiresIn: '1h' }
  );
}

async function testImageUpload() {
  try {
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const form = new FormData();
    form.append('media', testImageBuffer, {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    form.append('title', 'Test Image Upload');
    form.append('description', 'Testing image processing with unified processor');

    const token = generateTestToken();
    console.log('Generated test token for alice@test.com');
    console.log('Uploading test image...');
    
    const response = await fetch('http://localhost:3001/api/media/upload', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    console.log('Upload response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Image upload successful!');
      console.log('Media ID:', result.media.id);
      console.log('S3 Key:', result.s3Key);
      
      // Wait a moment and check if processing started
      console.log('Waiting 5 seconds to check processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check media processor logs
      console.log('Checking media processor logs...');
      const { exec } = require('child_process');
      exec('tail -n 10 /home/steve/Cursor/reedi/media-processor/logs/combined.log', (error, stdout, stderr) => {
        if (error) {
          console.error('Error checking logs:', error);
          return;
        }
        console.log('Recent media processor logs:');
        console.log(stdout);
      });
      
    } else {
      console.log('❌ Image upload failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Error uploading image:', error.message);
  }
}

testImageUpload();
