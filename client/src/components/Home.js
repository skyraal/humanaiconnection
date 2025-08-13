import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

function Home({ socket, setRoomData }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState(''); // 'create' or 'join'
  const navigate = useNavigate();

  useEffect(() => {
    const handleRoomCreated = (data) => {
      console.log('Room created data:', data);
      setIsLoading(false);
      setRoomData({...data, room: data.room}); 
      navigate(`/room/${data.roomId}`);
    };
    
    const handleRoomJoined = (data) => {
      console.log('Room joined data:', data);
      setIsLoading(false);
      setRoomData(data);
      navigate(`/room/${data.roomId}`);
    };

    const handleSocketError = (error) => {
      console.error('Socket error:', error);
      setError(error.message);
      setIsLoading(false);
    };
    
    socket.on('room_created', handleRoomCreated);
    socket.on('room_joined', handleRoomJoined);
    socket.on('error', handleSocketError);
    
    return () => {
      socket.off('room_created', handleRoomCreated);
      socket.off('room_joined', handleRoomJoined);
      socket.off('error', handleSocketError);
    };
  }, [socket, navigate, setRoomData]);

  const validateInputs = () => {
    if (!username.trim()) {
      setError('Please enter your name');
      return false;
    }
    
    if (username.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return false;
    }
    
    if (username.trim().length > 20) {
      setError('Name must be less than 20 characters');
      return false;
    }
    
    return true;
  };

  const createRoom = () => {
    if (!validateInputs()) return;
    
    setError('');
    setIsLoading(true);
    socket.emit('create_room', username.trim());
  };

  const joinRoom = () => {
    if (!validateInputs()) return;
    
    if (!roomId.trim()) {
      setError('Please enter a room code');
      return;
    }
    
    if (roomId.trim().length !== 6) {
      setError('Room code must be 6 characters long');
      return;
    }
    
    setError('');
    setIsLoading(true);
    socket.emit('join_room', { roomId: roomId.trim().toUpperCase(), username: username.trim() });
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  const resetMode = () => {
    setMode('');
    setError('');
    setRoomId('');
  };

  // Initial mode selection screen
  if (!mode) {
    return (
      <div className="home-container">
        <div className="rithm-logo">
          <img src='logo.png' id='rithm-logo' alt="Rithm Logo" />
        </div>
        
        <div className="home-content">
          <h1 className="rithm-gradient-text">Building human connection</h1>
          <h2>in the age of AI</h2>
          
          <div className="mode-selection">
            <div className="mode-card" onClick={() => setMode('create')}>
              <div className="mode-icon">🎮</div>
              <h3>Start a New Game</h3>
              <p>Create a room and invite friends to join</p>
              <button className="mode-btn create-mode">Start Game</button>
            </div>
            
            <div className="mode-card" onClick={() => setMode('join')}>
              <div className="mode-icon">🎯</div>
              <h3>Join a Game</h3>
              <p>Enter a room code to join an existing game</p>
              <button className="mode-btn join-mode">Join Game</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create room flow
  if (mode === 'create') {
    return (
      <div className="home-container">
        <div className="rithm-logo">
          <img src='logo.png' id='rithm-logo' alt="Rithm Logo" />
        </div>
        
        <div className="home-content">
          <button className="back-btn" onClick={resetMode}>← Back</button>
          
          <h1 className="mode-title">Start a New Game</h1>
          <p className="mode-description">
            You'll be the host and can share the room code with friends
          </p>
          
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="username">Your Name:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, createRoom)}
                placeholder="Enter your name"
                disabled={isLoading}
                maxLength={20}
                autoFocus
              />
            </div>
            
            <button 
              onClick={createRoom} 
              className="action-btn create-btn"
              disabled={isLoading || !username.trim()}
            >
              {isLoading ? 'Creating Game...' : 'Create Game Room'}
            </button>
          </div>
          
          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    );
  }

  // Join room flow
  if (mode === 'join') {
    return (
      <div className="home-container">
        <div className="rithm-logo">
          <img src='logo.png' id='rithm-logo' alt="Rithm Logo" />
        </div>
        
        <div className="home-content">
          <button className="back-btn" onClick={resetMode}>← Back</button>
          
          <h1 className="mode-title">Join a Game</h1>
          <p className="mode-description">
            Enter the 6-character room code shared by the game host
          </p>
          
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="roomId">Room Code:</label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyPress={(e) => handleKeyPress(e, () => {
                  if (roomId.length === 6) joinRoom();
                })}
                placeholder="ABC123"
                disabled={isLoading}
                maxLength={6}
                autoFocus
                className="room-code-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="username">Your Name:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, joinRoom)}
                placeholder="Enter your name"
                disabled={isLoading}
                maxLength={20}
              />
            </div>
            
            <button 
              onClick={joinRoom} 
              className="action-btn join-btn"
              disabled={isLoading || !username.trim() || roomId.length !== 6}
            >
              {isLoading ? 'Joining Game...' : 'Join Game'}
            </button>
          </div>
          
          {error && <p className="error-message">{error}</p>}
        </div>
      </div>
    );
  }
}

export default Home;