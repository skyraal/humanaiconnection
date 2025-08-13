# Load Testing Suite for Human AI Connection

This directory contains automated load testing tools to verify that the Human AI Connection game can handle 80+ concurrent users in a single room without issues.

## 🎯 Test Targets

- **Backend**: https://humanaiconnection.onrender.com
- **Frontend**: http://humanaiconnectiongame.onrender.com

## 📋 Test Scenarios

### 1. Basic Load Test (`load-test.js`)
- **Users**: 80 concurrent users
- **Duration**: 60 seconds
- **Purpose**: Test basic concurrent connections and game actions
- **Measures**: Connection success rate, latency, memory usage

### 2. Advanced Stress Test (`stress-test.js`)
- **Phases**: 5 progressive load phases
- **Users**: 10 → 40 → 80 → 100 → 80 users
- **Duration**: 4.5 minutes total
- **Purpose**: Comprehensive scalability testing
- **Measures**: Performance under varying loads, error rates, resource usage

### 3. Quick Validation Test
- **Users**: 20 concurrent users
- **Duration**: 30 seconds
- **Purpose**: Quick validation of basic functionality

## 🚀 Running Tests

### Prerequisites
```bash
cd server
npm install
```

### Available Commands

#### Using npm scripts (recommended):
```bash
# Run basic load test (80 users)
npm run test:load

# Run advanced stress test
npm run test:stress

# Run quick validation test (20 users)
npm run test:quick

# Show help
npm run test:help
```

#### Using direct node commands:
```bash
# Run basic load test
node run-tests.js load

# Run stress test
node run-tests.js stress

# Run quick test
node run-tests.js quick

# Show help
node run-tests.js help
```

## 📊 What the Tests Measure

### Connection Metrics
- Connection success rate
- Average connection time
- Failed connection count
- Concurrent user tracking

### Performance Metrics
- Average latency (ms)
- 95th percentile latency
- 99th percentile latency
- Actions per second
- Error rate per second

### Resource Usage
- Memory consumption (RSS, Heap)
- CPU usage patterns
- Network I/O

### Game-Specific Actions
- Room creation and joining
- Card choice submission
- Game state synchronization
- Real-time updates

## 📈 Performance Benchmarks

### Excellent Performance
- ✅ Average latency < 100ms
- ✅ Connection success rate ≥ 95%
- ✅ Action success rate ≥ 95%
- ✅ No memory leaks

### Good Performance
- ✅ Average latency < 500ms
- ✅ Connection success rate ≥ 90%
- ✅ Action success rate ≥ 90%

### Acceptable Performance
- ⚠️ Average latency < 1000ms
- ⚠️ Connection success rate ≥ 85%
- ⚠️ Action success rate ≥ 85%

### Poor Performance
- ❌ Average latency > 1000ms
- ❌ Connection success rate < 85%
- ❌ Action success rate < 85%

## 📁 Output Files

After running tests, the following files are generated:

- `load-test-results.json` - Detailed results from basic load test
- `stress-test-results.json` - Comprehensive results from stress test

These files contain:
- Raw performance data
- Statistical analysis
- Error logs
- Memory usage patterns
- Latency distributions

## 🔧 Configuration

### Basic Load Test Configuration (`load-test.js`)
```javascript
const CONFIG = {
  SERVER_URL: 'https://humanaiconnection.onrender.com',
  NUM_USERS: 80,
  TEST_DURATION: 60000, // 60 seconds
  CONNECTION_DELAY: 100, // ms between connections
  ACTION_DELAY: 2000, // ms between actions
  LOG_LEVEL: 'info'
};
```

### Stress Test Configuration (`stress-test.js`)
```javascript
const STRESS_CONFIG = {
  SERVER_URL: 'https://humanaiconnection.onrender.com',
  TEST_PHASES: [
    { name: 'Warm-up', users: 10, duration: 30000 },
    { name: 'Normal Load', users: 40, duration: 60000 },
    { name: 'High Load', users: 80, duration: 60000 },
    { name: 'Peak Load', users: 100, duration: 30000 },
    { name: 'Sustained Load', users: 80, duration: 60000 }
  ],
  CONNECTION_TIMEOUT: 15000,
  ACTION_INTERVAL: 1000,
  MONITORING_INTERVAL: 2000
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Increase `CONNECTION_TIMEOUT` in configuration
   - Check server availability
   - Verify network connectivity

2. **High Latency**
   - Reduce number of concurrent users
   - Increase delays between actions
   - Check server performance

3. **Memory Issues**
   - Monitor memory usage during tests
   - Check for memory leaks in server code
   - Reduce test duration if necessary

### Debug Mode
Set `LOG_LEVEL: 'debug'` in configuration for detailed logging:
```javascript
LOG_LEVEL: 'debug' // Shows all connection and action details
```

## 📝 Example Output

```
================================================================================
LOAD TEST RESULTS
================================================================================

Test Duration: 65.23 seconds
Total Users: 80
Max Concurrent Users: 80

--- CONNECTION STATS ---
Successful Connections: 80
Failed Connections: 0
Average Connection Time: 245.67ms

--- ACTION STATS ---
joinRoom:
  Success: 80
  Failed: 0
  Average Time: 156.78ms
submitChoice:
  Success: 400
  Failed: 0
  Average Time: 89.45ms

--- LATENCY STATS ---
Min Latency: 12.34ms
Max Latency: 567.89ms
Average Latency: 123.45ms
Total Samples: 480

--- PERFORMANCE ANALYSIS ---
✅ Excellent performance - Average latency under 100ms
✅ Excellent connection success rate
```

## 🔄 Continuous Testing

For continuous monitoring, consider:

1. **Scheduled Tests**: Run tests periodically (e.g., daily)
2. **Performance Regression**: Compare results over time
3. **Alerting**: Set up alerts for performance degradation
4. **Baseline Comparison**: Maintain performance baselines

## 📞 Support

If you encounter issues with the load testing:

1. Check the server logs for errors
2. Verify the hosted URLs are accessible
3. Review the generated JSON result files
4. Adjust configuration parameters as needed

---

**Note**: These tests simulate real user behavior and may impact the hosted service. Run during off-peak hours when possible.
