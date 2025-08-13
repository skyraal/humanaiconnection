# Human Connection Card Game

A real-time multiplayer card game that explores human connection in the age of AI. Players discuss and vote on various scenarios involving AI and human interaction.

## Recent Improvements (v2.0)

### 🚀 Performance & Scalability Improvements

- **Concurrent User Handling**: Improved to handle many users and rooms simultaneously
- **Memory Management**: Added automatic cleanup of inactive rooms (30-minute timeout)
- **Connection Pooling**: Enhanced Socket.IO configuration with better connection management
- **Error Recovery**: Robust error handling and automatic reconnection logic

### 🔧 Bug Fixes

- **Fixed "Waiting for host" issue**: Late joiners now properly sync with game state
- **Fixed host disconnection**: Automatic host transfer when host leaves
- **Fixed race conditions**: Proper state synchronization between server and clients
- **Fixed memory leaks**: Proper cleanup of socket event listeners

### 🎮 Game Experience Improvements

- **Late Joiner Support**: Players can now join games in progress seamlessly
- **State Recovery**: Automatic game state recovery for disconnected players
- **Real-time Updates**: Improved real-time synchronization of game state
- **Better Error Messages**: Clear, user-friendly error messages and recovery options
- **Welcome Messages**: Late joiners receive a welcome message and immediate access to current card

### 🛠 Technical Improvements

- **Server-Side Enhancements**:
  - Replaced object-based room storage with Map for better performance
  - Added comprehensive input validation
  - Implemented proper error handling for all socket events
  - Added health check and statistics endpoints
  - Automatic room cleanup to prevent memory leaks

- **Client-Side Enhancements**:
  - Improved socket connection management with reconnection logic
  - Better state management and synchronization
  - Loading states and error recovery UI
  - Responsive design improvements
  - Proper cleanup of event listeners

## Features

### Core Gameplay
- **Real-time multiplayer**: Play with friends in real-time
- **Card-based discussions**: Vote on AI-related scenarios
- **Three voting options**: Support, Erode, or Depends
- **Host controls**: Host can manage game flow
- **Late joiner support**: Join games already in progress

### Technical Features
- **WebSocket communication**: Real-time updates via Socket.IO
- **Automatic reconnection**: Handles network interruptions gracefully
- **Cross-platform**: Works on desktop and mobile browsers
- **Responsive design**: Optimized for all screen sizes
- **Admin panel**: Monitor game statistics and results

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd humanaiconnection
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Start the development servers**
   ```bash
   # Start server (from server directory)
   npm start
   
   # Start client (from client directory, in new terminal)
   npm start
   ```

4. **Access the application**
   - Client: http://localhost:3000
   - Server: http://localhost:3001
   - Admin panel: http://localhost:3001/admin
   - Health check: http://localhost:3001/health

## API Endpoints

### Game Endpoints
- `GET /health` - Server health check
- `GET /stats` - Server statistics
- `POST /cleanup` - Manual cleanup of inactive rooms
- `GET /admin` - Admin panel
- `GET /saved-games` - List saved game results

### Socket Events

#### Client to Server
- `create_room` - Create a new game room
- `join_room` - Join an existing room
- `start_game` - Start the game (host only)
- `submit_choice` - Submit card choice
- `reveal_choices` - Reveal all choices (host only)
- `next_card` - Move to next card (host only)
- `update_choice` - Update choice after discussion
- `get_room_data` - Request current room data

#### Server to Client
- `room_created` - Room creation confirmation
- `room_joined` - Room join confirmation
- `update_room` - Room state update
- `game_started` - Game start notification
- `game_state_sync` - Game state synchronization
- `choices_revealed` - Choices revealed notification
- `new_card` - New card notification
- `game_over` - Game completion
- `player_joined` - Player joined notification
- `player_left` - Player left notification
- `new_host` - Host transfer notification
- `error` - Error notification

## Deployment

### Environment Variables
- `NODE_ENV` - Set to 'production' for production deployment
- `PORT` - Server port (default: 3001)
- `REACT_APP_BACKEND_URL` - Backend URL for client (default: https://humanaiconnection.onrender.com)

### Production Build
```bash
# Build client
cd client
npm run build

# Start server
cd ../server
npm start
```

### Production Deployment
The game is deployed on:
- **Frontend**: Available at your frontend domain
- **Backend**: https://humanaiconnection.onrender.com
- **Admin Panel**: https://humanaiconnection.onrender.com/admin
- **Health Check**: https://humanaiconnection.onrender.com/health

## Monitoring & Maintenance

### Health Monitoring
- Health check endpoint: `/health`
- Server statistics: `/stats`
- Admin panel: `/admin`

### Automatic Cleanup
- Inactive rooms are automatically cleaned up after 30 minutes
- Manual cleanup available via `/cleanup` endpoint

### Performance Metrics
- Active rooms count
- Active connections count
- Total players count
- Active games count
- Server uptime
- Memory usage

## Troubleshooting

### Common Issues

1. **"Waiting for host to start the game"**
   - This has been fixed in v2.0
   - Late joiners now properly sync with game state

2. **Connection issues**
   - App now has automatic reconnection
   - Clear error messages and recovery options

3. **Players stuck in loading**
   - Improved loading states and error handling
   - Automatic retry mechanisms

4. **Memory leaks**
   - Automatic cleanup of inactive rooms
   - Proper event listener cleanup

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in server environment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the admin panel for server status
3. Check browser console for client-side errors
4. Check server logs for server-side errors 