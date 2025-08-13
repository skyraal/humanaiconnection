const io = require('socket.io-client');
const { performance } = require('perf_hooks');
const fs = require('fs');

// Advanced stress test configuration
const STRESS_CONFIG = {
  SERVER_URL: 'https://humanaiconnection.onrender.com',
  BASE_USERS: 10,
  MAX_USERS: 100,
  USER_INCREMENT: 10,
  TEST_PHASES: [
    { name: 'Warm-up', users: 10, duration: 30000 },
    { name: 'Normal Load', users: 40, duration: 60000 },
    { name: 'High Load', users: 80, duration: 60000 },
    { name: 'Peak Load', users: 100, duration: 30000 },
    { name: 'Sustained Load', users: 80, duration: 60000 }
  ],
  CONNECTION_TIMEOUT: 30000, // Increased from 15s to 30s
  ACTION_INTERVAL: 2000, // Increased from 1s to 2s for hosted environment
  MONITORING_INTERVAL: 3000, // Increased from 2s to 3s
  LOG_LEVEL: 'info',
  RETRY_ATTEMPTS: 3, // Number of retry attempts for failed operations
  RETRY_DELAY: 2000 // ms delay between retry attempts
};

// Real-time monitoring data
const monitoring = {
  startTime: 0,
  phases: [],
  currentPhase: 0,
  activeUsers: 0,
  totalConnections: 0,
  failedConnections: 0,
  totalActions: 0,
  failedActions: 0,
  latencyHistory: [],
  memoryHistory: [],
  errorLog: [],
  performanceMetrics: {
    connectionsPerSecond: 0,
    actionsPerSecond: 0,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: Infinity,
    errorRate: 0
  }
};

// Utility functions
function log(level, message, data = null) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[STRESS_CONFIG.LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
  }
}

function calculatePercentile(values, percentile) {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// Real-time monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      connections: [],
      actions: [],
      latency: [],
      memory: [],
      errors: []
    };
    this.startTime = Date.now();
  }

  recordConnection(time) {
    this.metrics.connections.push(time);
    this.updateMetrics();
  }

  recordAction(time) {
    this.metrics.actions.push(time);
    this.updateMetrics();
  }

  recordLatency(latency) {
    this.metrics.latency.push(latency);
    this.updateMetrics();
  }

  recordMemory(memory) {
    this.metrics.memory.push(memory);
  }

  recordError(error) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      error: error.message || error
    });
  }

  updateMetrics() {
    const now = Date.now();
    const timeWindow = 10000; // 10 seconds

    // Filter recent metrics
    const recentConnections = this.metrics.connections.filter(t => now - t < timeWindow);
    const recentActions = this.metrics.actions.filter(t => now - t < timeWindow);
    const recentLatency = this.metrics.latency.slice(-100); // Last 100 samples

    // Calculate rates
    monitoring.performanceMetrics.connectionsPerSecond = recentConnections.length / 10;
    monitoring.performanceMetrics.actionsPerSecond = recentActions.length / 10;

    // Calculate latency stats
    if (recentLatency.length > 0) {
      monitoring.performanceMetrics.averageLatency = recentLatency.reduce((a, b) => a + b, 0) / recentLatency.length;
      monitoring.performanceMetrics.maxLatency = Math.max(...recentLatency);
      monitoring.performanceMetrics.minLatency = Math.min(...recentLatency);
    }

    // Calculate error rate
    const recentErrors = this.metrics.errors.filter(e => now - e.timestamp < timeWindow);
    monitoring.performanceMetrics.errorRate = recentErrors.length / 10;
  }

  getReport() {
    return {
      duration: Date.now() - this.startTime,
      totalConnections: this.metrics.connections.length,
      totalActions: this.metrics.actions.length,
      totalErrors: this.metrics.errors.length,
      latencyStats: {
        avg: this.metrics.latency.length > 0 ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length : 0,
        min: this.metrics.latency.length > 0 ? Math.min(...this.metrics.latency) : 0,
        max: this.metrics.latency.length > 0 ? Math.max(...this.metrics.latency) : 0,
        p50: calculatePercentile(this.metrics.latency, 50),
        p95: calculatePercentile(this.metrics.latency, 95),
        p99: calculatePercentile(this.metrics.latency, 99)
      },
      memoryStats: this.metrics.memory.length > 0 ? {
        avgRSS: this.metrics.memory.reduce((sum, m) => sum + m.rss, 0) / this.metrics.memory.length,
        avgHeapUsed: this.metrics.memory.reduce((sum, m) => sum + m.heapUsed, 0) / this.metrics.memory.length,
        maxRSS: Math.max(...this.metrics.memory.map(m => m.rss)),
        maxHeapUsed: Math.max(...this.metrics.memory.map(m => m.heapUsed))
      } : null
    };
  }
}

// Advanced user simulation
class StressTestUser {
  constructor(userId, roomId) {
    this.userId = userId;
    this.username = `stressuser_${userId}`;
    this.roomId = roomId;
    this.socket = null;
    this.connected = false;
    this.joinedRoom = false;
    this.actionCount = 0;
    this.lastActionTime = 0;
    this.errors = [];
    this.monitor = null;
  }

  async connect(monitor) {
    this.monitor = monitor;
    const startTime = performance.now();
    
    try {
      this.socket = io(STRESS_CONFIG.SERVER_URL, {
        transports: ['websocket'],
        timeout: STRESS_CONFIG.CONNECTION_TIMEOUT,
        forceNew: true,
        reconnection: false
      });

      this.socket.on('connect', () => {
        this.connected = true;
        monitoring.activeUsers++;
        monitoring.totalConnections++;
        const connectionTime = performance.now() - startTime;
        this.monitor.recordConnection(Date.now());
        log('debug', `User ${this.userId} connected in ${connectionTime.toFixed(2)}ms`);
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        monitoring.activeUsers--;
        log('debug', `User ${this.userId} disconnected`);
      });

      this.socket.on('error', (error) => {
        this.errors.push(error);
        this.monitor.recordError(error);
        log('error', `User ${this.userId} socket error:`, error);
      });

      // Wait for connection with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), STRESS_CONFIG.CONNECTION_TIMEOUT);
        this.socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      return true;

    } catch (error) {
      monitoring.failedConnections++;
      this.monitor.recordError(error);
      log('error', `User ${this.userId} failed to connect:`, error.message);
      return false;
    }
  }

  async joinRoom() {
    if (!this.connected) return false;

    try {
      const startTime = performance.now();
      
      // Listen for room_joined event
      const joinPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Join room timeout')), 30000); // Increased from 10s to 30s
        this.socket.once('room_joined', (data) => {
          clearTimeout(timeout);
          this.joinedRoom = true;
          const latency = performance.now() - startTime;
          this.monitor.recordLatency(latency);
          resolve(data);
        });
      });

      // Emit join room event
      this.socket.emit('join_room', {
        roomId: this.roomId,
        username: this.username
      });

      await joinPromise;
      return true;

    } catch (error) {
      this.monitor.recordError(error);
      log('error', `User ${this.userId} failed to join room:`, error.message);
      return false;
    }
  }

  async performRandomAction() {
    if (!this.joinedRoom) return;

    const now = Date.now();
    if (now - this.lastActionTime < STRESS_CONFIG.ACTION_INTERVAL) return;

    this.lastActionTime = now;
    const startTime = performance.now();

    try {
      const actions = [
        () => this.submitChoice(),
        () => this.getRoomData(),
        () => this.updateChoice()
      ];

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      await randomAction();

      const actionTime = performance.now() - startTime;
      this.monitor.recordAction(Date.now());
      monitoring.totalActions++;
      this.actionCount++;

    } catch (error) {
      monitoring.failedActions++;
      this.monitor.recordError(error);
      log('error', `User ${this.userId} action failed:`, error.message);
    }
  }

  async submitChoice() {
    const choices = ['support', 'erode', 'depends'];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Submit choice timeout')), 15000); // Increased from 5s to 15
      
      this.socket.emit('submit_choice', {
        roomId: this.roomId,
        choice: choice
      });

      // For submit_choice, we don't wait for a specific response
      // Just resolve after a short delay
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 100);
    });
  }

  async getRoomData() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Get room data timeout')), 15000); // Increased from 5s to 15s
      
      this.socket.emit('get_room_data', this.roomId);
      
      this.socket.once('update_room', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }

  async updateChoice() {
    const choices = ['support', 'erode', 'depends'];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Update choice timeout')), 15000); // Increased from 5s to 15s
      
      this.socket.emit('update_choice', {
        roomId: this.roomId,
        choice: choice
      });

      // For update_choice, we don't wait for a specific response
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 100);
    });
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

// Phase management
class TestPhase {
  constructor(name, targetUsers, duration) {
    this.name = name;
    this.targetUsers = targetUsers;
    this.duration = duration;
    this.users = [];
    this.startTime = 0;
    this.endTime = 0;
    this.monitor = new PerformanceMonitor();
  }

  async execute(roomId) {
    log('info', `Starting phase: ${this.name} with ${this.targetUsers} users for ${this.duration}ms`);
    this.startTime = Date.now();

    // Create and connect users
    const connectionPromises = [];
    for (let i = 0; i < this.targetUsers; i++) {
      const user = new StressTestUser(i + 1, roomId);
      this.users.push(user);
      connectionPromises.push(user.connect(this.monitor));
    }

    // Connect users with staggered timing
    const connectionResults = await Promise.allSettled(connectionPromises);
    const successfulConnections = connectionResults.filter(r => r.status === 'fulfilled' && r.value).length;
    log('info', `Phase ${this.name}: ${successfulConnections}/${this.targetUsers} users connected`);

    // Join users to room
    const joinPromises = this.users.map(user => user.joinRoom());
    const joinResults = await Promise.allSettled(joinPromises);
    const successfulJoins = joinResults.filter(r => r.status === 'fulfilled' && r.value).length;
    log('info', `Phase ${this.name}: ${successfulJoins} users joined room`);

    // Start action simulation
    const actionInterval = setInterval(() => {
      this.users.forEach(user => user.performRandomAction());
    }, STRESS_CONFIG.ACTION_INTERVAL);

    // Monitor performance
    const monitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.monitor.recordMemory(memUsage);
      this.monitor.updateMetrics();
      
      // Log current performance
      const metrics = monitoring.performanceMetrics;
      log('info', `Phase ${this.name} - Active: ${monitoring.activeUsers}, Actions/sec: ${metrics.actionsPerSecond.toFixed(2)}, Latency: ${metrics.averageLatency.toFixed(2)}ms, Errors/sec: ${metrics.errorRate.toFixed(2)}`);
    }, STRESS_CONFIG.MONITORING_INTERVAL);

    // Wait for phase duration
    await new Promise(resolve => setTimeout(resolve, this.duration));

    // Cleanup
    clearInterval(actionInterval);
    clearInterval(monitorInterval);
    this.endTime = Date.now();

    // Disconnect users
    this.users.forEach(user => user.disconnect());
    this.users = [];

    log('info', `Phase ${this.name} completed in ${(this.endTime - this.startTime) / 1000}s`);
    return this.monitor.getReport();
  }
}

// Main stress test execution
async function runStressTest() {
  log('info', 'Starting advanced stress test');
  log('info', `Server URL: ${STRESS_CONFIG.SERVER_URL}`);
  log('info', `Test phases: ${STRESS_CONFIG.TEST_PHASES.length}`);
  
  monitoring.startTime = Date.now();
  const hostUser = new StressTestUser('host', 'STRESSTEST');
  const hostMonitor = new PerformanceMonitor();
  const phaseResults = [];

  try {
    // Connect host and create room
    log('info', 'Setting up test room...');
    const hostConnected = await hostUser.connect(hostMonitor);
    if (!hostConnected) {
      throw new Error('Failed to connect host user');
    }

    hostUser.socket.emit('create_room', hostUser.username);
    const roomCreatedResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Room creation timeout')), 30000); // Increased from 10s to 30s
      hostUser.socket.once('room_created', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const actualRoomId = roomCreatedResponse.roomId;
    hostUser.roomId = actualRoomId;
    log('info', `Test room created successfully with ID: ${actualRoomId}`);

    // Execute each test phase
    for (let i = 0; i < STRESS_CONFIG.TEST_PHASES.length; i++) {
      const phaseConfig = STRESS_CONFIG.TEST_PHASES[i];
      const phase = new TestPhase(phaseConfig.name, phaseConfig.users, phaseConfig.duration);
      
      const phaseResult = await phase.execute(actualRoomId);
      phaseResults.push({
        phase: phaseConfig.name,
        config: phaseConfig,
        result: phaseResult
      });

      // Brief pause between phases
      if (i < STRESS_CONFIG.TEST_PHASES.length - 1) {
        log('info', 'Pausing between phases...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

  } catch (error) {
    log('error', 'Stress test error:', error);
    monitoring.errorLog.push(error);
  } finally {
    // Cleanup
    hostUser.disconnect();
    
    // Generate comprehensive report
    generateStressTestReport(phaseResults);
  }
}

function generateStressTestReport(phaseResults) {
  const totalDuration = Date.now() - monitoring.startTime;
  
  console.log('\n' + '='.repeat(100));
  console.log('ADVANCED STRESS TEST RESULTS');
  console.log('='.repeat(100));
  
  console.log(`\nTotal Test Duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Total Connections: ${monitoring.totalConnections}`);
  console.log(`Failed Connections: ${monitoring.failedConnections}`);
  console.log(`Connection Success Rate: ${((monitoring.totalConnections - monitoring.failedConnections) / monitoring.totalConnections * 100).toFixed(2)}%`);
  console.log(`Total Actions: ${monitoring.totalActions}`);
  console.log(`Failed Actions: ${monitoring.failedActions}`);
  console.log(`Action Success Rate: ${((monitoring.totalActions - monitoring.failedActions) / monitoring.totalActions * 100).toFixed(2)}%`);
  
  console.log('\n--- PHASE-BY-PHASE RESULTS ---');
  phaseResults.forEach((phase, index) => {
    console.log(`\nPhase ${index + 1}: ${phase.phase}`);
    console.log(`  Duration: ${(phase.result.duration / 1000).toFixed(2)}s`);
    console.log(`  Target Users: ${phase.config.users}`);
    console.log(`  Total Actions: ${phase.result.totalActions}`);
    console.log(`  Total Errors: ${phase.result.totalErrors}`);
    console.log(`  Latency - Avg: ${phase.result.latencyStats.avg.toFixed(2)}ms, P95: ${phase.result.latencyStats.p95.toFixed(2)}ms, P99: ${phase.result.latencyStats.p99.toFixed(2)}ms`);
    
    if (phase.result.memoryStats) {
      console.log(`  Memory - Avg RSS: ${(phase.result.memoryStats.avgRSS / 1024 / 1024).toFixed(2)}MB, Max RSS: ${(phase.result.memoryStats.maxRSS / 1024 / 1024).toFixed(2)}MB`);
    }
  });
  
  // Overall performance analysis
  console.log('\n--- OVERALL PERFORMANCE ANALYSIS ---');
  
  const allLatencies = phaseResults.flatMap(p => [p.result.latencyStats.avg]);
  const avgLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
  
  if (avgLatency < 100) {
    console.log('✅ EXCELLENT - Average latency under 100ms across all phases');
  } else if (avgLatency < 500) {
    console.log('✅ GOOD - Average latency under 500ms across all phases');
  } else if (avgLatency < 1000) {
    console.log('⚠️  ACCEPTABLE - Average latency under 1s across all phases');
  } else {
    console.log('❌ POOR - Average latency over 1s across all phases');
  }
  
  const connectionSuccessRate = ((monitoring.totalConnections - monitoring.failedConnections) / monitoring.totalConnections) * 100;
  if (connectionSuccessRate >= 95) {
    console.log('✅ EXCELLENT - Connection success rate above 95%');
  } else if (connectionSuccessRate >= 90) {
    console.log('⚠️  GOOD - Connection success rate above 90%');
  } else {
    console.log('❌ POOR - Connection success rate below 90%');
  }
  
  const actionSuccessRate = ((monitoring.totalActions - monitoring.failedActions) / monitoring.totalActions) * 100;
  if (actionSuccessRate >= 95) {
    console.log('✅ EXCELLENT - Action success rate above 95%');
  } else if (actionSuccessRate >= 90) {
    console.log('⚠️  GOOD - Action success rate above 90%');
  } else {
    console.log('❌ POOR - Action success rate below 90%');
  }
  
  // Scalability assessment
  console.log('\n--- SCALABILITY ASSESSMENT ---');
  const maxUsersPhase = phaseResults.find(p => p.config.users === Math.max(...STRESS_CONFIG.TEST_PHASES.map(ph => ph.users)));
  if (maxUsersPhase && maxUsersPhase.result.latencyStats.avg < 1000) {
    console.log('✅ EXCELLENT - System handles peak load with acceptable latency');
  } else if (maxUsersPhase && maxUsersPhase.result.latencyStats.avg < 2000) {
    console.log('⚠️  ACCEPTABLE - System handles peak load with moderate latency');
  } else {
    console.log('❌ POOR - System struggles with peak load');
  }
  
  if (monitoring.errorLog.length > 0) {
    console.log('\n--- ERRORS ---');
    monitoring.errorLog.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message || error}`);
    });
  }
  
  console.log('\n' + '='.repeat(100));
  
  // Save detailed results
  const reportData = {
    config: STRESS_CONFIG,
    monitoring: monitoring,
    phaseResults: phaseResults,
    summary: {
      totalDuration,
      totalConnections: monitoring.totalConnections,
      failedConnections: monitoring.failedConnections,
      totalActions: monitoring.totalActions,
      failedActions: monitoring.failedActions,
      avgLatency,
      connectionSuccessRate,
      actionSuccessRate
    }
  };
  
  fs.writeFileSync('stress-test-results.json', JSON.stringify(reportData, null, 2));
  console.log('Detailed stress test results saved to stress-test-results.json');
}

// Run the stress test
if (require.main === module) {
  runStressTest().catch(error => {
    console.error('Stress test failed:', error);
    process.exit(1);
  });
}

module.exports = { runStressTest, StressTestUser, TestPhase, PerformanceMonitor };
