#!/usr/bin/env node

/**
 * Test script for llama.cpp local AI server
 * Run this to verify your local AI setup is working
 */

const http = require('http');

const LLAMACPP_BASE = process.env.LLAMACPP_OPENAI_BASE || 'http://127.0.0.1:8080/v1';

console.log('==========================================');
console.log('RadPal Local AI Test');
console.log('==========================================\n');

// Function to test server health
async function testHealth() {
  console.log('1. Testing server connection...');
  
  try {
    const url = new URL('/models', LLAMACPP_BASE);
    
    return new Promise((resolve, reject) => {
      http.get(url.toString(), { timeout: 2000 }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Server is running at', LLAMACPP_BASE);
          resolve(true);
        } else {
          console.log('❌ Server responded with status:', res.statusCode);
          resolve(false);
        }
      }).on('error', (err) => {
        console.log('❌ Cannot connect to server:', err.message);
        console.log('\nMake sure the server is running:');
        console.log('  npm run llama:serve');
        resolve(false);
      });
    });
  } catch (error) {
    console.log('❌ Error testing health:', error.message);
    return false;
  }
}

// Function to test generation
async function testGeneration() {
  console.log('\n2. Testing text generation...');
  
  const testPrompt = {
    model: 'local-llamacpp',
    messages: [
      { role: 'system', content: 'You are a helpful radiology assistant.' },
      { role: 'user', content: 'Complete this radiology finding: The anterior cruciate ligament shows' }
    ],
    temperature: 0.25,
    max_tokens: 50
  };
  
  try {
    const url = new URL('/chat/completions', LLAMACPP_BASE);
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(testPrompt);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 8080,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        },
        timeout: 30000 // 30 second timeout for generation
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              const text = response?.choices?.[0]?.message?.content;
              
              if (text) {
                console.log('✅ Generation successful!');
                console.log('\nGenerated text:');
                console.log('---');
                console.log(text);
                console.log('---');
                resolve(true);
              } else {
                console.log('❌ No text in response');
                resolve(false);
              }
            } catch (e) {
              console.log('❌ Invalid response format:', e.message);
              resolve(false);
            }
          } else {
            console.log('❌ Server error:', res.statusCode);
            console.log('Response:', data);
            resolve(false);
          }
        });
      });
      
      req.on('error', (err) => {
        console.log('❌ Request failed:', err.message);
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.log('❌ Request timed out (30s). The model might be loading...');
        console.log('Try running the test again in a minute.');
        resolve(false);
      });
      
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.log('❌ Error testing generation:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('Testing endpoint:', LLAMACPP_BASE);
  console.log('');
  
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n==========================================');
    console.log('Test Failed - Server Not Running');
    console.log('==========================================\n');
    console.log('To start the local AI server:');
    console.log('1. Open a new terminal/command prompt');
    console.log('2. Navigate to RadPal directory');
    console.log('3. Run: npm run llama:serve');
    console.log('4. Keep that terminal open');
    console.log('5. Run this test again');
    process.exit(1);
  }
  
  const genOk = await testGeneration();
  
  console.log('\n==========================================');
  if (genOk) {
    console.log('All Tests Passed! ✅');
    console.log('==========================================\n');
    console.log('Your local AI is working correctly.');
    console.log('You can now use "Mistral (Local)" in RadPal.');
  } else {
    console.log('Test Failed - Generation Error');
    console.log('==========================================\n');
    console.log('The server is running but generation failed.');
    console.log('Check that the model file exists and is valid.');
  }
}

// Run the tests
runTests();