import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Home from './components/Home';
import GameRoom from './components/GameRoom';
import './App.css';

// Create socket with improved configuration
const createSocket = () => {
  return io.connect(process.env.REACT_APP_BACKEND_URL || 'https://humanaiconnection.onrender.com', {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 5
  });
};

const socket = createSocket();

function App() {
  const [isConnected, setIsConnected] = useState(false); 
  const [roomData, setRoomData] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
      console.log('Connected to server');
    };
    
    const handleDisconnect = (reason) => {
      setIsConnected(false);
      console.log('Disconnected from server:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        socket.connect();
      }
    };
    
    const handleConnectError = (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server. Please check your internet connection.');
    };
    
    const handleReconnect = (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionError(null);
    };
    
    const handleReconnectError = (error) => {
      console.error('Reconnection error:', error);
      setConnectionError('Failed to reconnect to server. Please refresh the page.');
    };
    
    const handleReconnectFailed = () => {
      console.error('Reconnection failed');
      setConnectionError('Unable to reconnect to server. Please refresh the page.');
    };
    
    const handleError = (error) => {
      console.error('Socket error:', error);
      setConnectionError(error.message || 'An error occurred');
    };
    
    // Add event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);
    socket.on('error', handleError);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
      socket.off('error', handleError);
    };
  }, []);
  
  const retryConnection = () => {
    setConnectionError(null);
    socket.disconnect();
    socket.connect();
  };

  // Show connection error overlay
  if (connectionError && !isConnected) {
    return (
      <div className="connection-error-overlay">
        <div className="connection-error-content">
          <h2>Connection Error</h2>
          <p>{connectionError}</p>
          <button onClick={retryConnection} className="retry-connection-btn">
            Retry Connection
          </button>
          <button onClick={() => window.location.reload()} className="refresh-btn">
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

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
