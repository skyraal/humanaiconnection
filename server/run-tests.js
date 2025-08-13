#!/usr/bin/env node

const { runLoadTest } = require('./load-test');
const { runStressTest } = require('./stress-test');

// Test configurations for hosted version
const HOSTED_CONFIG = {
  SERVER_URL: 'https://humanaiconnection.onrender.com',
  FRONTEND_URL: 'http://humanaiconnectiongame.onrender.com',
  DESCRIPTION: 'Testing hosted version on Render'
};

function printBanner() {
  console.log('\n' + '='.repeat(80));
  console.log('HUMAN AI CONNECTION - LOAD TESTING SUITE');
  console.log('='.repeat(80));
  console.log(`Backend: ${HOSTED_CONFIG.SERVER_URL}`);
  console.log(`Frontend: ${HOSTED_CONFIG.FRONTEND_URL}`);
  console.log(`Description: ${HOSTED_CONFIG.DESCRIPTION}`);
  console.log('='.repeat(80) + '\n');
}

function printUsage() {
  console.log('Usage:');
  console.log('  node run-tests.js load     - Run basic load test (80 users)');
  console.log('  node run-tests.js stress   - Run advanced stress test (phased testing)');
  console.log('  node run-tests.js quick    - Run quick test (20 users)');
  console.log('  node run-tests.js help     - Show this help message');
  console.log('\nExamples:');
  console.log('  node run-tests.js load     # Test 80 concurrent users');
  console.log('  node run-tests.js stress   # Comprehensive stress testing');
  console.log('  node run-tests.js quick    # Quick validation test');
}

async function runQuickTest() {
  console.log('Running quick validation test (20 users)...');
  
  // Temporarily modify the load test config for quick testing
  const { CONFIG } = require('./load-test');
  const originalUsers = CONFIG.NUM_USERS;
  const originalDuration = CONFIG.TEST_DURATION;
  
  CONFIG.NUM_USERS = 20;
  CONFIG.TEST_DURATION = 30000; // 30 seconds
  
  try {
    await runLoadTest();
  } finally {
    // Restore original config
    CONFIG.NUM_USERS = originalUsers;
    CONFIG.TEST_DURATION = originalDuration;
  }
}

async function main() {
  const command = process.argv[2] || 'help';
  
  printBanner();
  
  switch (command.toLowerCase()) {
    case 'load':
      console.log('🚀 Starting basic load test with 80 users...');
      console.log('This will test concurrent connections and basic game actions.\n');
      await runLoadTest();
      break;
      
    case 'stress':
      console.log('🔥 Starting advanced stress test...');
      console.log('This will test multiple phases with increasing load.\n');
      await runStressTest();
      break;
      
    case 'quick':
      console.log('⚡ Starting quick validation test...');
      console.log('This will test 20 users for 30 seconds.\n');
      await runQuickTest();
      break;
      
    case 'help':
    default:
      printUsage();
      break;
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { main, HOSTED_CONFIG };
