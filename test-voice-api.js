#!/usr/bin/env node

/**
 * Test script for Voice API endpoints
 * Usage: node test-voice-api.js
 */

const http = require('http');

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 3000;

// Test getting voice connection token
function testGetToken() {
  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/v1/voice/token',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Add authentication if needed
      // 'Authorization': 'Bearer YOUR_TOKEN'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Token endpoint response:');
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });

    req.end();
  });
}

// Test health check
function testHealthCheck() {
  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/v1/voice/health',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('\n✅ Voice health check:');
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });

    req.end();
  });
}

// Test usage statistics
function testUsageStats() {
  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/v1/voice/usage?period=7d',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('\n✅ Usage statistics:');
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      reject(error);
    });

    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log(`🎯 Testing Voice API at http://${API_HOST}:${API_PORT}\n`);
  
  try {
    await testHealthCheck();
    await testGetToken();
    await testUsageStats();
    
    console.log('\n✨ All tests completed successfully!');
    console.log('\n📝 Note: To test WebSocket connection, use a WebSocket client with:');
    console.log(`   URL: ws://${API_HOST}:${API_PORT}/api/v1/voice/realtime?token=YOUR_TOKEN`);
    console.log('   Or use the token from the /api/v1/voice/token endpoint\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();