const io = require('socket.io-client');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  SERVER_URL: 'https://humanaiconnection.onrender.com',
  NUM_USERS: 80,
  ROOM_ID: 'LOADTEST',
  TEST_DURATION: 60000, // 60 seconds
  CONNECTION_DELAY: 200, // ms between connections (increased for hosted environment)
  ACTION_DELAY: 3000, // ms between actions (increased for hosted environment)
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  RETRY_ATTEMPTS: 3, // Number of retry attempts for failed operations
  RETRY_DELAY: 2000 // ms delay between retry attempts
};

// Test results
const results = {
  startTime: 0,
  endTime: 0,
  connections: {
    successful: 0,
    failed: 0,
    totalTime: 0,
    averageTime: 0
  },
  actions: {
    joinRoom: { success: 0, failed: 0, totalTime: 0, averageTime: 0 },
    submitChoice: { success: 0, failed: 0, totalTime: 0, averageTime: 0 },
    updateChoice: { success: 0, failed: 0, totalTime: 0, averageTime: 0 },
    gameEvents: { received: 0, totalTime: 0, averageTime: 0 }
  },
  errors: [],
  memoryUsage: [],
  latency: {
    min: Infinity,
    max: 0,
    average: 0,
    samples: []
  },
  concurrentUsers: 0,
  maxConcurrentUsers: 0
};

// Utility functions
function log(level, message, data = null) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[CONFIG.LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
  }
}

function measureLatency(socket, event, callback) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${event}`));
    }, 70000); // Increased from 10s to 30s

    socket.once(event, (data) => {
      clearTimeout(timeout);
      const latency = performance.now() - start;
      results.latency.samples.push(latency);
      results.latency.min = Math.min(results.latency.min, latency);
      results.latency.max = Math.max(results.latency.max, latency);
      
      if (callback) callback(data, latency);
      resolve({ data, latency });
    });
  });
}

function updateLatencyStats() {
  if (results.latency.samples.length > 0) {
    results.latency.average = results.latency.samples.reduce((a, b) => a + b, 0) / results.latency.samples.length;
  }
}

function updateActionStats(action, success, time) {
  if (success) {
    results.actions[action].success++;
    results.actions[action].totalTime += time;
    results.actions[action].averageTime = results.actions[action].totalTime / results.actions[action].success;
  } else {
    results.actions[action].failed++;
  }
}

// Memory monitoring
function recordMemoryUsage() {
  const memUsage = process.memoryUsage();
  results.memoryUsage.push({
    timestamp: Date.now(),
    rss: memUsage.rss,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external
  });
}

// User simulation class
class TestUser {
  constructor(userId) {
    this.userId = userId;
    this.username = `testuser_${userId}`;
    this.socket = null;
    this.connected = false;
    this.joinedRoom = false;
    this.roomId = CONFIG.ROOM_ID;
    this.actions = [];
    this.errors = [];
  }

  async connect() {
    const startTime = performance.now();
    
    for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        this.socket = io(CONFIG.SERVER_URL, {
          transports: ['websocket'],
          timeout: 30000, // Increased from 10s to 30s
          forceNew: true
        });

        this.socket.on('connect', () => {
          this.connected = true;
          results.concurrentUsers++;
          results.maxConcurrentUsers = Math.max(results.maxConcurrentUsers, results.concurrentUsers);
          log('debug', `User ${this.userId} connected`);
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
          results.concurrentUsers--;
          log('debug', `User ${this.userId} disconnected`);
        });

        this.socket.on('error', (error) => {
          this.errors.push(error);
          log('error', `User ${this.userId} socket error:`, error);
        });

        // Wait for connection
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000); // Increased from 10s to 30s
          this.socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        const connectionTime = performance.now() - startTime;
        results.connections.success++;
        results.connections.totalTime += connectionTime;
        results.connections.averageTime = results.connections.totalTime / results.connections.success;
        
        log('info', `User ${this.userId} connected successfully in ${connectionTime.toFixed(2)}ms (attempt ${attempt})`);
        return true;

      } catch (error) {
        log('warn', `User ${this.userId} connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < CONFIG.RETRY_ATTEMPTS) {
          log('info', `Retrying connection for user ${this.userId} in ${CONFIG.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        } else {
          const connectionTime = performance.now() - startTime;
          results.connections.failed++;
          this.errors.push(error);
          log('error', `User ${this.userId} failed to connect after ${CONFIG.RETRY_ATTEMPTS} attempts:`, error.message);
          return false;
        }
      }
    }
  }

  async joinRoom() {
    if (!this.connected) {
      log('warn', `User ${this.userId} cannot join room - not connected`);
      return false;
    }

    const startTime = performance.now();
    
    try {
      // First, set up the listener for the response
      const joinPromise = measureLatency(this.socket, 'room_joined', (data, latency) => {
        this.joinedRoom = true;
        log('debug', `User ${this.userId} joined room in ${latency.toFixed(2)}ms`);
      });

      // Then emit the join room event
      this.socket.emit('join_room', {
        roomId: this.roomId,
        username: this.username
      });

      // Wait for the response
      await joinPromise;

      const joinTime = performance.now() - startTime;
      updateActionStats('joinRoom', true, joinTime);
      
      return true;

    } catch (error) {
      const joinTime = performance.now() - startTime;
      updateActionStats('joinRoom', false, joinTime);
      this.errors.push(error);
      log('error', `User ${this.userId} failed to join room:`, error.message);
      return false;
    }
  }

  async submitChoice() {
    if (!this.joinedRoom) {
      log('warn', `User ${this.userId} cannot submit choice - not in room`);
      return false;
    }

    const startTime = performance.now();
    const choices = ['support', 'erode', 'depends'];
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];

    try {
      this.socket.emit('submit_choice', {
        roomId: this.roomId,
        choice: randomChoice
      });

      const submitTime = performance.now() - startTime;
      updateActionStats('submitChoice', true, submitTime);
      
      log('debug', `User ${this.userId} submitted choice: ${randomChoice}`);
      return true;

    } catch (error) {
      const submitTime = performance.now() - startTime;
      updateActionStats('submitChoice', false, submitTime);
      this.errors.push(error);
      log('error', `User ${this.userId} failed to submit choice:`, error.message);
      return false;
    }
  }

  async updateChoice() {
    if (!this.joinedRoom) {
      log('warn', `User ${this.userId} cannot update choice - not in room`);
      return false;
    }

    const startTime = performance.now();
    const choices = ['support', 'erode', 'depends'];
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];

    try {
      this.socket.emit('update_choice', {
        roomId: this.roomId,
        choice: randomChoice
      });

      const updateTime = performance.now() - startTime;
      updateActionStats('updateChoice', true, updateTime);
      
      log('debug', `User ${this.userId} updated choice: ${randomChoice}`);
      return true;

    } catch (error) {
      const updateTime = performance.now() - startTime;
      updateActionStats('updateChoice', false, updateTime);
      this.errors.push(error);
      log('error', `User ${this.userId} failed to update choice:`, error.message);
      return false;
    }
  }

  async simulateGameActions() {
    if (!this.joinedRoom) return;

    // Wait a bit before starting actions to ensure game state is synchronized
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Simulate random game actions with proper state checking
    const actions = [
      () => this.submitChoice(),
      () => this.socket.emit('get_room_data', this.roomId),
      // Only update choice if we're in reveal phase (this will be handled by server validation)
      () => this.updateChoice()
    ];

    for (let i = 0; i < 3; i++) { // Reduced from 5 to 3 to avoid overwhelming
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      try {
        await randomAction();
      } catch (error) {
        log('debug', `User ${this.userId} action failed (expected):`, error.message);
      }
      // Longer delay between actions
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.joinedRoom = false;
  }
}

// Main test execution
async function runLoadTest() {
  log('info', `Starting load test with ${CONFIG.NUM_USERS} users`);
  log('info', `Server URL: ${CONFIG.SERVER_URL}`);
  log('info', `Test duration: ${CONFIG.TEST_DURATION}ms`);
  
  results.startTime = performance.now();
  const users = [];
  const hostUser = new TestUser('host');

  try {
    // Connect host user first
    log('info', 'Connecting host user...');
    const hostConnected = await hostUser.connect();
    if (!hostConnected) {
      throw new Error('Failed to connect host user');
    }

    // Create room with host
    log('info', 'Creating test room...');
    hostUser.socket.emit('create_room', hostUser.username);
    const roomCreatedResponse = await measureLatency(hostUser.socket, 'room_created');
    const actualRoomId = roomCreatedResponse.data.roomId;
    log('info', `Test room created successfully with ID: ${actualRoomId}`);
    
    // Update all users to use the actual room ID
    hostUser.roomId = actualRoomId;

    // Connect all test users
    log('info', `Connecting ${CONFIG.NUM_USERS} test users...`);
    for (let i = 0; i < CONFIG.NUM_USERS; i++) {
      const user = new TestUser(i + 1);
      user.roomId = actualRoomId; // Use the actual room ID
      users.push(user);
      
      const connected = await user.connect();
      if (!connected) {
        log('warn', `Failed to connect user ${i + 1}`);
      }
      
      // Small delay between connections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, CONFIG.CONNECTION_DELAY));
    }

    log('info', `Connected ${results.connections.success} users successfully`);

    // Join all users to the room
    log('info', 'Joining users to room...');
    const joinPromises = users.map(user => user.joinRoom());
    const joinResults = await Promise.allSettled(joinPromises);
    
    const successfulJoins = joinResults.filter(result => result.status === 'fulfilled' && result.value).length;
    log('info', `${successfulJoins} users successfully joined the room`);

    // Start the game
    log('info', 'Starting the game...');
    hostUser.socket.emit('start_game', actualRoomId);
    await measureLatency(hostUser.socket, 'game_started');
    log('info', 'Game started successfully');

    // Wait for game state to propagate to all users
    log('info', 'Waiting for game state synchronization...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate game actions for all users
    log('info', 'Simulating game actions...');
    const actionPromises = users.map(user => user.simulateGameActions());
    await Promise.allSettled(actionPromises);

    // Wait before revealing choices
    log('info', 'Waiting before revealing choices...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Reveal choices
    log('info', 'Revealing choices...');
    hostUser.socket.emit('reveal_choices', actualRoomId);
    await measureLatency(hostUser.socket, 'choices_revealed');

    // Wait for reveal state to propagate
    log('info', 'Waiting for reveal state synchronization...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Allow some time for users to update choices during reveal phase
    log('info', 'Allowing time for choice updates during reveal phase...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Move to next card
    log('info', 'Moving to next card...');
    hostUser.socket.emit('next_card', actualRoomId);
    await measureLatency(hostUser.socket, 'new_card');

    // Monitor for a period
    log('info', 'Monitoring performance...');
    const monitorInterval = setInterval(recordMemoryUsage, 5000);
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_DURATION));
    clearInterval(monitorInterval);

  } catch (error) {
    log('error', 'Load test error:', error);
    results.errors.push(error);
  } finally {
    // Cleanup
    log('info', 'Cleaning up connections...');
    users.forEach(user => user.disconnect());
    hostUser.disconnect();
    
    results.endTime = performance.now();
    updateLatencyStats();
    
    // Generate report
    generateReport();
  }
}

function generateReport() {
  const totalTime = results.endTime - results.startTime;
  const totalActions = Object.values(results.actions).reduce((sum, action) => 
    sum + action.success + action.failed, 0);
  
  console.log('\n' + '='.repeat(80));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\nTest Duration: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`Total Users: ${CONFIG.NUM_USERS}`);
  console.log(`Max Concurrent Users: ${results.maxConcurrentUsers}`);
  
  console.log('\n--- CONNECTION STATS ---');
  console.log(`Successful Connections: ${results.connections.success}`);
  console.log(`Failed Connections: ${results.connections.failed}`);
  console.log(`Average Connection Time: ${results.connections.averageTime.toFixed(2)}ms`);
  
  console.log('\n--- ACTION STATS ---');
  Object.entries(results.actions).forEach(([action, stats]) => {
    console.log(`${action}:`);
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Average Time: ${stats.averageTime.toFixed(2)}ms`);
  });
  
  console.log('\n--- LATENCY STATS ---');
  console.log(`Min Latency: ${results.latency.min.toFixed(2)}ms`);
  console.log(`Max Latency: ${results.latency.max.toFixed(2)}ms`);
  console.log(`Average Latency: ${results.latency.average.toFixed(2)}ms`);
  console.log(`Total Samples: ${results.latency.samples.length}`);
  
  console.log('\n--- MEMORY USAGE ---');
  if (results.memoryUsage.length > 0) {
    const latest = results.memoryUsage[results.memoryUsage.length - 1];
    console.log(`Final RSS: ${(latest.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Final Heap Used: ${(latest.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Final Heap Total: ${(latest.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  }
  
  console.log('\n--- PERFORMANCE ANALYSIS ---');
  const avgLatency = results.latency.average;
  if (avgLatency < 100) {
    console.log('✅ Excellent performance - Average latency under 100ms');
  } else if (avgLatency < 500) {
    console.log('✅ Good performance - Average latency under 500ms');
  } else if (avgLatency < 1000) {
    console.log('⚠️  Acceptable performance - Average latency under 1s');
  } else {
    console.log('❌ Poor performance - Average latency over 1s');
  }
  
  const connectionSuccessRate = (results.connections.success / CONFIG.NUM_USERS) * 100;
  if (connectionSuccessRate >= 95) {
    console.log('✅ Excellent connection success rate');
  } else if (connectionSuccessRate >= 90) {
    console.log('⚠️  Good connection success rate');
  } else {
    console.log('❌ Poor connection success rate');
  }
  
  if (results.errors.length > 0) {
    console.log('\n--- ERRORS ---');
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Save detailed results to file
  const fs = require('fs');
  const reportData = {
    config: CONFIG,
    results: results,
    summary: {
      totalTime,
      totalActions,
      connectionSuccessRate,
      avgLatency
    }
  };
  
  fs.writeFileSync('load-test-results.json', JSON.stringify(reportData, null, 2));
  console.log('Detailed results saved to load-test-results.json');
}

// Run the test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, TestUser, CONFIG };
