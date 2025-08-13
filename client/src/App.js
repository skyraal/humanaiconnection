import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './components/Home';
import GameRoom from './components/GameRoom';
import './App.css';

// Determine server URL based on environment
const getServerUrl = () => {
  // Check for environment variable first
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }
  
  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    // Default production URL (will be overridden by environment variable)
    return 'https://humanaiconnection.onrender.com';
  }
  
  // Development URL
  return 'http://localhost:3001';
};

// Initialize socket connection
const socket = io(getServerUrl(), {
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  timeout: 20000,
  forceNew: true
});

function App() {
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    // Socket connection event handlers
    socket.on('connect', () => {
      console.log('Connected to server:', getServerUrl());
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={<Home socket={socket} setRoomData={setRoomData} />} 
          />
          <Route 
            path="/room/:roomId" 
            element={<GameRoom socket={socket} roomData={roomData} setRoomData={setRoomData} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
