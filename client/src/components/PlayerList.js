import React from 'react';
import '../styles/PlayerList.css';

function PlayerList({ players, playerChoices, revealChoices, currentUserId }) {
  const getPlayerStatus = (playerId) => {
    if (!revealChoices) {
      if (playerChoices[playerId]) {
        return 'Ready';
      } else {
        return 'Choosing...';
      }
    } else {
      return playerChoices[playerId] || 'No choice';
    }
  };
  
  const getStatusColor = (status) => {
    if (status === 'Ready') return 'green';
    if (status === 'Choosing...') return 'orange';
    if (status === 'support') return 'green';
    if (status === 'erode') return 'red';
    if (status === 'depends') return 'blue';
    return 'gray';
  };
  
  return (
    <div className="player-list">
      <h3>Players</h3>
      <ul>
        {players.map((player) => (
          <li key={player.id} className={player.id === currentUserId ? 'current-player' : ''}>
            <span className="player-name">{player.username} {player.id === currentUserId ? '(You)' : ''}</span>
            <span 
              className="player-status" 
              style={{ color: getStatusColor(getPlayerStatus(player.id)) }}
            >
              {getPlayerStatus(player.id)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlayerList;
