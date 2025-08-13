import React, { useState, useEffect } from 'react';
import '../styles/CardBoard.css';

function CardBoard({ card, playerChoice, onCardDrop, revealChoices, playerChoices, players }) {
  const [dragActive, setDragActive] = useState(false);
  const [dragColumn, setDragColumn] = useState(null);
  
  // For card animation
  const [animateCard, setAnimateCard] = useState(false);
  
  useEffect(() => {
    // Animate new card entrance
    setAnimateCard(true);
    const timeout = setTimeout(() => setAnimateCard(false), 500);
    return () => clearTimeout(timeout);
  }, [card]);
  
  const findUsername = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.username : 'Unknown';
  };
  
  // Calculate choice counts
  const getChoiceCounts = () => {
    const counts = {
      support: 0,
      erode: 0,
      depends: 0
    };
    
    Object.values(playerChoices).forEach(choice => {
      if (choice && counts.hasOwnProperty(choice)) {
        counts[choice]++;
      }
    });
    
    return counts;
  };
  
  const choiceCounts = getChoiceCounts();
  const totalChoices = choiceCounts.support + choiceCounts.erode + choiceCounts.depends;
  
  const renderPlayerCards = (column) => {
    if (!revealChoices) return null;
    
    return Object.entries(playerChoices)
      .filter(([id, choice]) => choice === column)
      .map(([id, choice]) => (
        <div 
          key={id} 
          className="player-choice-card"
          style={{ 
            transform: `rotate(${Math.random() * 6 - 3}deg)`,
            transition: 'all 0.3s ease'
          }}
        >
          {findUsername(id)}
        </div>
      ));
  };
  
  // Drag and drop handlers
  const handleDragStart = (e, column) => {
    setDragActive(true);
    setDragColumn(column);
  };
  
  const handleDragEnd = () => {
    setDragActive(false);
    setDragColumn(null);
  };
  
  const handleDragOver = (e, column) => {
    e.preventDefault();
  };
  
  const handleDrop = (e, column) => {
    e.preventDefault();
    onCardDrop(column);
    setDragActive(false);
    setDragColumn(null);
  };
  
  return (
    <div className="card-board">
      <div className="card-prompt">
        <h3>Current Scenario:</h3>
        <div 
          className={`card-content ${animateCard ? 'card-animate' : ''}`}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, playerChoice)}
          onDragEnd={handleDragEnd}
        >
          {card}
        </div>
      </div>
      
      {/* Choice Counter - Only show when choices are revealed */}
      {revealChoices && (
        <div className="choice-counter">
          <div className="counter-item">
            <span className="counter-label">Support:</span>
            <span className="counter-value">{choiceCounts.support}</span>
          </div>
          <div className="counter-item">
            <span className="counter-label">It Depends:</span>
            <span className="counter-value">{choiceCounts.depends}</span>
          </div>
          <div className="counter-item">
            <span className="counter-label">Erode:</span>
            <span className="counter-value">{choiceCounts.erode}</span>
          </div>
          <div className="counter-total">
            <span className="total-label">Total:</span>
            <span className="total-value">{totalChoices}</span>
          </div>
        </div>
      )}
      
      <div className="columns-container">
        <div 
          className={`column support ${playerChoice === 'support' ? 'selected' : ''} ${dragActive && dragColumn !== 'support' ? 'drag-over' : ''}`}
          onClick={() => onCardDrop('support')}
          onDragOver={(e) => handleDragOver(e, 'support')}
          onDrop={(e) => handleDrop(e, 'support')}
        >
          <h3>SUPPORT</h3>
          {playerChoice === 'support' && !revealChoices && (
            <div className="your-card">Your Card</div>
          )}
          {renderPlayerCards('support')}
        </div>
        
        <div 
          className={`column depends ${playerChoice === 'depends' ? 'selected' : ''} ${dragActive && dragColumn !== 'depends' ? 'drag-over' : ''}`}
          onClick={() => onCardDrop('depends')}
          onDragOver={(e) => handleDragOver(e, 'depends')}
          onDrop={(e) => handleDrop(e, 'depends')}
        >
          <h3>IT DEPENDS</h3>
          {playerChoice === 'depends' && !revealChoices && (
            <div className="your-card">Your Card</div>
          )}
          {renderPlayerCards('depends')}
        </div>
        
        <div 
          className={`column erode ${playerChoice === 'erode' ? 'selected' : ''} ${dragActive && dragColumn !== 'erode' ? 'drag-over' : ''}`}
          onClick={() => onCardDrop('erode')}
          onDragOver={(e) => handleDragOver(e, 'erode')}
          onDrop={(e) => handleDrop(e, 'erode')}
        >
          <h3>ERODE</h3>
          {playerChoice === 'erode' && !revealChoices && (
            <div className="your-card">Your Card</div>
          )}
          {renderPlayerCards('erode')}
        </div>
      </div>
      
      <div className="instructions">
        {!playerChoice && !revealChoices ? (
          <p>Drag the card or click on a column to make your choice</p>
        ) : !revealChoices ? (
          <p>Waiting for others to make their choices...</p>
        ) : (
          <p>Discussion time! You can still move your card if you change your mind.</p>
        )}
      </div>
    </div>
  );
}

export default CardBoard;
