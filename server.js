const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const roomState = {
  phase: 'betting',
  countdownMs: 20000,
  roundId: 1,
  bets: {},
  players: {},
  history: []
};

let countdownInterval;

function serializePlayers() {
  return Object.values(roomState.players).map((p) => ({
    id: p.id,
    name: p.name,
    coins: p.coins,
    totalWins: p.totalWins,
    totalBets: p.totalBets
  }));
}

function emitState() {
  io.emit('room_state', {
    phase: roomState.phase,
    countdownMs: roomState.countdownMs,
    roundId: roomState.roundId,
    bets: roomState.bets,
    players: serializePlayers(),
    history: roomState.history.slice(-10)
  });
}

function resetRound() {
  roomState.phase = 'betting';
  roomState.countdownMs = 20000;
  roomState.bets = {};
  roomState.roundId += 1;
  emitState();
}

function resolveRound() {
  roomState.phase = 'spinning';
  emitState();

  setTimeout(() => {
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const winners = [];

    for (const [playerId, bet] of Object.entries(roomState.bets)) {
      const player = roomState.players[playerId];
      if (!player) continue;

      if (bet.side === result) {
        const reward = bet.amount * 2;
        player.coins += reward;
        player.totalWins += 1;
        winners.push({ name: player.name, reward });
      }
    }

    roomState.history.push({
      roundId: roomState.roundId,
      result,
      winners,
      timestamp: new Date().toISOString()
    });

    io.emit('round_result', {
      result,
      winners,
      roundId: roomState.roundId
    });

    resetRound();
  }, 20000);
}

function tick() {
  if (roomState.phase !== 'betting') return;
  roomState.countdownMs -= 1000;
  if (roomState.countdownMs <= 0) {
    roomState.countdownMs = 0;
    emitState();
    resolveRound();
    return;
  }
  emitState();
}

io.on('connection', (socket) => {
  socket.on('join_game', ({ name }) => {
    const safeName = (name || '').trim().slice(0, 20) || 'Player';
    roomState.players[socket.id] = {
      id: socket.id,
      name: safeName,
      coins: 100,
      totalWins: 0,
      totalBets: 0
    };
    emitState();
  });

  socket.on('place_bet', ({ side, amount }) => {
    const player = roomState.players[socket.id];
    if (!player || roomState.phase !== 'betting') return;

    const normalizedSide = side === 'heads' ? 'heads' : side === 'tails' ? 'tails' : null;
    const betAmount = Number(amount);
    if (!normalizedSide || !Number.isFinite(betAmount) || betAmount <= 0) return;
    if (betAmount > player.coins) return;

    if (roomState.bets[socket.id]) {
      player.coins += roomState.bets[socket.id].amount;
    }

    player.coins -= betAmount;
    player.totalBets += 1;
    roomState.bets[socket.id] = { side: normalizedSide, amount: betAmount, name: player.name };

    const extraMs = Math.random() < 0.5 ? 1000 : 2000;
    roomState.countdownMs = Math.min(roomState.countdownMs + extraMs, 40000);

    emitState();
  });

  socket.on('disconnect', () => {
    delete roomState.players[socket.id];
    delete roomState.bets[socket.id];
    emitState();
  });

  emitState();
});

app.use(express.static(path.join(__dirname, 'public')));

countdownInterval = setInterval(tick, 1000);

server.listen(PORT, () => {
  console.log(`CoinFlip server running on http://localhost:${PORT}`);
});
