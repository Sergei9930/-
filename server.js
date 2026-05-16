const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BETTING_MS = 20000;
const SPIN_MS = 20000;
const MAX_BETTING_MS = 45000;

const roomState = {
  phase: 'betting',
  countdownMs: BETTING_MS,
  roundId: 1,
  bets: {},
  players: {},
  history: [],
  result: null
};

function serializePlayers() {
  return Object.values(roomState.players).map((p) => ({
    id: p.id,
    name: p.name,
    coins: p.coins,
    totalWins: p.totalWins,
    totalBets: p.totalBets
  }));
}

function getBetStats() {
  const stats = {
    headsCount: 0,
    tailsCount: 0,
    headsAmount: 0,
    tailsAmount: 0
  };

  for (const bet of Object.values(roomState.bets)) {
    if (bet.side === 'heads') {
      stats.headsCount += 1;
      stats.headsAmount += bet.amount;
    } else {
      stats.tailsCount += 1;
      stats.tailsAmount += bet.amount;
    }
  }
  return stats;
}

function emitState() {
  io.emit('room_state', {
    phase: roomState.phase,
    countdownMs: roomState.countdownMs,
    roundId: roomState.roundId,
    bets: roomState.bets,
    betStats: getBetStats(),
    players: serializePlayers(),
    history: roomState.history.slice(-10),
    result: roomState.result
  });
}

function resetRound() {
  roomState.phase = 'betting';
  roomState.countdownMs = BETTING_MS;
  roomState.bets = {};
  roomState.roundId += 1;
  roomState.result = null;
  emitState();
}

function resolveRound() {
  roomState.phase = 'spinning';
  roomState.countdownMs = SPIN_MS;
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

    roomState.result = result;
    roomState.history.push({
      roundId: roomState.roundId,
      result,
      winners,
      timestamp: new Date().toISOString()
    });

    io.emit('round_result', { result, winners, roundId: roomState.roundId });

    setTimeout(resetRound, 3000);
  }, SPIN_MS);
}

function tick() {
  if (roomState.countdownMs <= 0) return;

  roomState.countdownMs -= 1000;
  if (roomState.countdownMs < 0) roomState.countdownMs = 0;

  if (roomState.countdownMs === 0) {
    emitState();
    if (roomState.phase === 'betting') resolveRound();
    return;
  }

  emitState();
}

io.on('connection', (socket) => {
  socket.on('join_game', ({ name }) => {
    const safeName = (name || '').trim().slice(0, 20) || 'Player';
    const existing = roomState.players[socket.id];

    roomState.players[socket.id] = existing || {
      id: socket.id,
      name: safeName,
      coins: 100,
      totalWins: 0,
      totalBets: 0
    };
    roomState.players[socket.id].name = safeName;

    emitState();
  });

  socket.on('place_bet', ({ side, amount }) => {
    const player = roomState.players[socket.id];
    if (!player || roomState.phase !== 'betting') return;

    const normalizedSide = side === 'heads' ? 'heads' : side === 'tails' ? 'tails' : null;
    const betAmount = Number(amount);

    if (!normalizedSide || !Number.isFinite(betAmount) || betAmount <= 0) return;
    if (betAmount > player.coins + (roomState.bets[socket.id]?.amount || 0)) return;

    if (roomState.bets[socket.id]) {
      player.coins += roomState.bets[socket.id].amount;
    }

    player.coins -= betAmount;
    player.totalBets += 1;
    roomState.bets[socket.id] = { side: normalizedSide, amount: betAmount, name: player.name };

    const extraMs = Math.random() < 0.5 ? 1000 : 2000;
    roomState.countdownMs = Math.min(roomState.countdownMs + extraMs, MAX_BETTING_MS);

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
setInterval(tick, 1000);

server.listen(PORT, () => {
  console.log(`CoinFlip server running on http://localhost:${PORT}`);
});
