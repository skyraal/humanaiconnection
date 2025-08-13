# Human Connection Card Game

A real-time multiplayer card game that explores the boundaries between human and AI interactions. Players discuss scenarios and vote on whether they represent "human" or "AI" behavior.

## Features

### Core Gameplay
- **Real-time multiplayer** - Play with friends in private rooms
- **Dynamic card system** - 30+ thought-provoking scenarios
- **Voting mechanism** - Vote "Human" or "AI" for each scenario
- **Discussion phase** - Reveal and discuss everyone's choices
- **Progressive gameplay** - Work through cards one by one

### Late-Joining Support ✨ NEW
- **Join mid-game** - Players can join rooms that are already in progress
- **Missed cards summary** - Late joiners can view previous cards and group responses
- **Seamless integration** - Late joiners can participate in current and future cards
- **Catch-up experience** - No penalty for joining late, full game experience

### Analytics & Research Data 📊 NEW
- **Comprehensive tracking** - Every game action is logged for research
- **User analytics** - Track unique visitors, session duration, engagement
- **Game statistics** - Monitor completion rates, average players, card responses
- **Response analysis** - Detailed breakdown of human vs AI voting patterns
- **Card performance** - See which scenarios generate the most discussion
- **Real-time dashboard** - Live admin panel with analytics

## Technology Stack

### Backend
- **Node.js** with Express
- **Socket.IO** for real-time communication
- **Redis** for session management and caching
- **SQLite** for persistent analytics data
- **Rate limiting** for API protection

### Frontend
- **React** with hooks
- **Socket.IO client** for real-time updates
- **CSS Grid/Flexbox** for responsive design
- **Modern UI/UX** with smooth animations

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Redis server
- npm or yarn

### Backend Setup
```bash
cd server
npm install
npm start
```

### Frontend Setup
```bash
cd client
npm install
npm start
```

### Environment Variables
Create a `.env` file in the server directory:
```env
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3001
```

## Analytics & Research Features

### Data Collection
The game automatically collects comprehensive data for research purposes:

- **User visits** - IP addresses, user agents, session tracking
- **Game sessions** - Duration, completion rates, player counts
- **Player participation** - Join/leave times, host transfers
- **Card responses** - Individual votes, response times
- **Room activity** - All game events and state changes

### Admin Dashboard
Access the analytics dashboard at `/admin`:

- **Real-time stats** - Active rooms, current players
- **Visitor trends** - Daily unique visitors and total visits
- **Game analytics** - Completion rates, average duration, player engagement
- **Response distribution** - Human vs AI voting patterns
- **Card performance** - Most discussed scenarios and response rates

### API Endpoints
All analytics data is available via REST API:

- `GET /analytics/visits` - Visitor statistics
- `GET /analytics/games` - Game session data
- `GET /analytics/players` - Player participation metrics
- `GET /analytics/responses` - Response distribution
- `GET /analytics/cards` - Individual card performance

### Data Export
Game results are automatically saved to:
- **Redis** - Temporary storage (24-hour TTL)
- **SQLite** - Persistent analytics database
- **JSON files** - Individual game results

## Game Flow

### Room Creation
1. Host creates a room and gets a 6-character room code
2. Share the code with friends to join
3. Wait for players to join (minimum 1 player)

### Gameplay
1. **Host starts the game** - Cards are shuffled and first card is shown
2. **Voting phase** - Players vote "Human" or "AI" for the scenario
3. **Discussion phase** - Host reveals all choices for group discussion
4. **Next card** - Host advances to the next scenario
5. **Repeat** - Continue until all cards are completed

### Late-Joining Process
1. **Join mid-game** - Use room code to join active games
2. **Missed cards notification** - System alerts you about missed content
3. **Review previous cards** - View missed scenarios and group responses
4. **Participate fully** - Join current and future card discussions

## Research Applications

This game is designed for research on:
- **Human-AI interaction** - How people perceive AI vs human behavior
- **Group dynamics** - How discussions influence individual choices
- **Technology acceptance** - Attitudes toward AI in social contexts
- **Decision-making** - Factors that influence human vs AI categorization

### Data Privacy
- No personal information is collected beyond IP addresses
- All data is anonymized for research purposes
- No login required - completely anonymous participation
- Data retention policies can be customized

## Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Manual Deployment
1. Set up Redis server
2. Configure environment variables
3. Install dependencies
4. Start server and client
5. Set up reverse proxy (nginx recommended)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or support, please open an issue on GitHub or contact the development team. 