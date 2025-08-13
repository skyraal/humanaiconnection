import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './components/Home';
import GameRoom from './components/GameRoom';
import './App.css';

// Determine the correct backend URL
const getBackendUrl = () => {
  // Check for environment variable first
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    // Use the correct production backend URL
    return 'https://humanaiconnection.onrender.com';
  }
  
  // Development URL
  return 'http://localhost:3001';
};

const socket = io.connect(getBackendUrl());

function App() {
  // Renamed to isConnected to avoid eslint warning
  const [isConnected, setIsConnected] = useState(false); 
  const [roomData, setRoomData] = useState(null);
  
  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server:', getBackendUrl());
    });
    
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });
    
    socket.on('error', (error) => {
      alert(error.message);
    });
    
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
    };
  }, []);
  
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home socket={socket} setRoomData={setRoomData} />} />
          <Route 
            path="/room/:roomId" 
            element={
              roomData ? (
                <GameRoom 
                  socket={socket} 
                  roomData={roomData} 
                  setRoomData={setRoomData} 
                />
              ) : (
                <Navigate to="/" />
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
