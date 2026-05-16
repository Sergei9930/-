const socket = io();
const timerEl = document.getElementById('timer');
const roundStatus = document.getElementById('roundStatus');
const marketInfo = document.getElementById('marketInfo');
const coinEl = document.getElementById('coin');
const myCoinsEl = document.getElementById('myCoins');
const myWinsEl = document.getElementById('myWins');
const playersList = document.getElementById('playersList');
const historyList = document.getElementById('historyList');

let myId = null;

socket.on('connect', () => {
  myId = socket.id;
  const savedName = localStorage.getItem('coinflip_name') || 'Player';
  document.getElementById('nickname').value = savedName;
  socket.emit('join_game', { name: savedName });
});

document.getElementById('joinBtn').addEventListener('click', () => {
  const name = document.getElementById('nickname').value.trim() || 'Player';
  localStorage.setItem('coinflip_name', name);
  socket.emit('join_game', { name });
});

document.querySelectorAll('.bet-buttons button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    const amount = Number(document.getElementById('betAmount').value);
    socket.emit('place_bet', { side, amount });
  });
});

socket.on('room_state', (state) => {
  timerEl.textContent = `${(state.countdownMs / 1000).toFixed(1)}s`;

  if (state.phase === 'betting') {
    roundStatus.textContent = `Раунд #${state.roundId}: Прием ставок`;
  } else {
    roundStatus.textContent = `Раунд #${state.roundId}: Монета крутится 20 секунд`;
  }

  coinEl.classList.toggle('spinning', state.phase === 'spinning');

  marketInfo.textContent = `Орел: ${state.betStats.headsCount} игроков (${state.betStats.headsAmount} мон.) | Решка: ${state.betStats.tailsCount} игроков (${state.betStats.tailsAmount} мон.)`;

  playersList.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    const bet = state.bets[p.id]
      ? ` | ставка: ${state.bets[p.id].amount} на ${state.bets[p.id].side === 'heads' ? 'орла' : 'решку'}`
      : '';
    li.textContent = `${p.name}: ${p.coins} монет${bet}`;
    playersList.appendChild(li);

    if (p.id === myId) {
      myCoinsEl.textContent = p.coins;
      myWinsEl.textContent = p.totalWins;
    }
  });

  historyList.innerHTML = '';
  [...state.history].reverse().forEach((h) => {
    const li = document.createElement('li');
    li.textContent = `#${h.roundId}: ${h.result === 'heads' ? 'Орел' : 'Решка'} (${h.winners.length} победителей)`;
    historyList.appendChild(li);
  });
});

socket.on('round_result', ({ result, winners }) => {
  const winnerText = winners.length
    ? winners.map((w) => `${w.name} +${w.reward}`).join(', ')
    : 'Нет победителей';
  roundStatus.textContent = `Результат: ${result === 'heads' ? 'Орел' : 'Решка'} | ${winnerText}`;
});
