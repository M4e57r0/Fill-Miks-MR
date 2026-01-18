// Простая модель данных в памяти
let state = {
    teams: {
        gandony: [null, null, null, null, null, null], // 6 слотов
        pupsiki: [null, null, null, null, null, null]
    },
    waiting: [],
    played: []
};

const STORAGE_KEY = 'marvel_rivals_filliolina_state_v1';

// Роли по слотам в командах
const TEAM_ROLES_ORDER = ['Танк', 'Танк', 'DPS', 'DPS', 'Саппорт', 'Саппорт'];

// Контекст редактирования
let editingContext = null;
let editingPlayer = null;

// ====== Утилиты ======

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.teams && parsed.waiting && parsed.played) {
            state = parsed;
        }
    } catch (e) {
        console.error('Ошибка чтения state из localStorage', e);
    }
}

// Создание DOM для иконок ролей
function createRoleIcons(roles) {
    const container = document.createElement('div');
    container.className = 'role-icons';
    if (!roles || !roles.length) return container;

    roles.forEach(r => {
        const span = document.createElement('span');
        span.classList.add('role-icon', r);
        if (r === 'tank') span.textContent = 'T';
        if (r === 'dps') span.textContent = 'D';
        if (r === 'support') span.textContent = 'S';
        container.appendChild(span);
    });
    return container;
}

// ====== Рендер ======

function renderTeams() {
    document.querySelectorAll('.team-table').forEach(table => {
        const teamKey = table.dataset.team;
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        TEAM_ROLES_ORDER.forEach((roleLabel, index) => {
            const tr = document.createElement('tr');
            tr.dataset.team = teamKey;
            tr.dataset.slotIndex = index;
            tr.classList.add('team-slot');

            const tdRole = document.createElement('td');
            tdRole.textContent = roleLabel;
            tdRole.className = 'role-cell';
            tr.appendChild(tdRole);

            const player = state.teams[teamKey][index];

            const tdNickGame = document.createElement('td');
            const tdNickTwitch = document.createElement('td');
            const tdRank = document.createElement('td');
            const tdGames = document.createElement('td');
            const tdRoles = document.createElement('td');
            const tdAction = document.createElement('td');
            tdAction.className = 'action-cell';

            if (player) {
                tr.dataset.playerId = player.id;
                tr.draggable = true;

                tdNickGame.textContent = player.gameNick;
                tdNickTwitch.textContent = player.twitchNick;
                tdRank.textContent = player.rank;
                tdGames.textContent = player.games;
                tdRoles.appendChild(createRoleIcons(player.roles));

                const btnToPlayed = document.createElement('button');
                btnToPlayed.textContent = '↓';
                btnToPlayed.addEventListener('click', () => {
                    movePlayerFromTeamToPlayed(teamKey, index);
                });

                const btnEdit = document.createElement('button');
                btnEdit.textContent = '✎';
                btnEdit.style.marginLeft = '4px';
                btnEdit.addEventListener('click', () => {
                    openEditModal(player, {
                        type: 'team',
                        team: teamKey,
                        slotIndex: index
                    });
                });

                tdAction.appendChild(btnToPlayed);
                tdAction.appendChild(btnEdit);

                addDragHandlersForTeamSlot(tr);
            } else {
                tdNickGame.textContent = '';
                tdNickTwitch.textContent = '';
                tdRank.textContent = '';
                tdGames.textContent = '';
                tdRoles.textContent = '';
                tdAction.textContent = '';
                tr.draggable = false;
            }

            tr.appendChild(tdNickGame);
            tr.appendChild(tdNickTwitch);
            tr.appendChild(tdRank);
            tr.appendChild(tdGames);
            tr.appendChild(tdRoles);
            tr.appendChild(tdAction);

            addDropHandlersForTeamSlot(tr);
            tbody.appendChild(tr);
        });
    });
}

function renderQueue(tableId, listName) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    state[listName].forEach((player, index) => {
        const tr = document.createElement('tr');
        tr.dataset.playerId = player.id;
        tr.dataset.list = listName;
        tr.draggable = true;

        const tdNickGame = document.createElement('td');
        const tdNickTwitch = document.createElement('td');
        const tdRank = document.createElement('td');
        const tdGames = document.createElement('td');
        const tdRoles = document.createElement('td');

        tdNickGame.textContent = player.gameNick;
        tdNickTwitch.textContent = player.twitchNick;
        tdRank.textContent = player.rank;
        tdGames.textContent = player.games;
        tdRoles.appendChild(createRoleIcons(player.roles));

        tr.appendChild(tdNickGame);
        tr.appendChild(tdNickTwitch);
        tr.appendChild(tdRank);
        tr.appendChild(tdGames);
        tr.appendChild(tdRoles);

        addDragHandlersForQueueRow(tr);

        tr.addEventListener('dblclick', () => {
            openEditModal(player, {
                type: 'list',
                list: listName,
                index
            });
        });

        tbody.appendChild(tr);
    });
}

function renderAll() {
    renderTeams();
    renderQueue('queue-waiting', 'waiting');
    renderQueue('queue-played', 'played');
}

// ====== Drag & Drop ======

let dragData = null;

function addDragHandlersForQueueRow(tr) {
    tr.addEventListener('dragstart', e => {
        dragData = {
            type: 'queue',
            list: tr.dataset.list,
            playerId: tr.dataset.playerId
        };
        e.dataTransfer.effectAllowed = 'move';
    });

    tr.addEventListener('dragend', () => {
        dragData = null;
        clearDragOverHighlights();
    });
}

function addDragHandlersForTeamSlot(tr) {
    tr.addEventListener('dragstart', e => {
        const team = tr.dataset.team;
        const slotIndex = parseInt(tr.dataset.slotIndex, 10);
        const player = state.teams[team][slotIndex];
        if (!player) {
            e.preventDefault();
            return;
        }
        dragData = {
            type: 'team',
            team,
            slotIndex,
            playerId: player.id
        };
        e.dataTransfer.effectAllowed = 'move';
    });

    tr.addEventListener('dragend', () => {
        dragData = null;
        clearDragOverHighlights();
    });
}

function addDropHandlersForTeamSlot(tr) {
    tr.addEventListener('dragover', e => {
        if (!dragData) return;
        e.preventDefault();
        tr.classList.add('drag-over');
    });

    tr.addEventListener('dragleave', () => {
        tr.classList.remove('drag-over');
    });

    tr.addEventListener('drop', () => {
        tr.classList.remove('drag-over');
        if (!dragData) return;

        const team = tr.dataset.team;
        const slotIndex = parseInt(tr.dataset.slotIndex, 10);

        if (dragData.type === 'queue') {
            movePlayerFromQueueToTeam(dragData.list, dragData.playerId, team, slotIndex);
        } else if (dragData.type === 'team') {
            movePlayerBetweenTeamSlots(dragData.team, dragData.slotIndex, team, slotIndex);
        }

        dragData = null;
    });
}

function clearDragOverHighlights() {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// ====== Операции с игроками ======

function findPlayerInList(listName, playerId) {
    const idx = state[listName].findIndex(p => p.id === playerId);
    if (idx === -1) return null;
    return { index: idx, player: state[listName][idx] };
}

function movePlayerFromQueueToTeam(listName, playerId, team, slotIndex) {
    const found = findPlayerInList(listName, playerId);
    if (!found) return;

    // Проверяем, есть ли в слоте игрок
    const existingPlayer = state.teams[team][slotIndex];

    // Если есть — отправляем его в сыгравшие
    if (existingPlayer) {
        state.played.push(existingPlayer);
    }

    // Ставим нового игрока
    state.teams[team][slotIndex] = found.player;

    // Удаляем его из очереди
    state[listName].splice(found.index, 1);

    saveState();
    renderAll();
}


function movePlayerBetweenTeamSlots(fromTeam, fromIndex, toTeam, toIndex) {
    const fromPlayer = state.teams[fromTeam][fromIndex];
    const toPlayer = state.teams[toTeam][toIndex];

    state.teams[toTeam][toIndex] = fromPlayer;
    state.teams[fromTeam][fromIndex] = toPlayer || null;

    saveState();
    renderAll();
}

function movePlayerFromTeamToPlayed(team, slotIndex) {
    const player = state.teams[team][slotIndex];
    if (!player) return;

    state.teams[team][slotIndex] = null;
    state.played.push(player);

    saveState();
    renderAll();
}

// ====== Кнопки: +1 игра, очистка ======

function incrementGamesInTeams() {
    ['gandony', 'pupsiki'].forEach(team => {
        state.teams[team] = state.teams[team].map(p => {
            if (!p) return null;
            return { ...p, games: (p.games || 0) + 1 };
        });
    });
    saveState();
    renderAll();
}

function clearAllLists() {
    state = {
        teams: {
            gandony: [null, null, null, null, null, null],
            pupsiki: [null, null, null, null, null, null]
        },
        waiting: [],
        played: []
    };
    saveState();
    renderAll();
}

function clearTeamsOnly() {
    state.teams.gandony = [null, null, null, null, null, null];
    state.teams.pupsiki = [null, null, null, null, null, null];
    saveState();
    renderAll();
}

// ====== Модалка добавления игрока ======

function openAddModal() {
    document.getElementById('modal-add').classList.remove('hidden');
}

function closeAddModal() {
    document.getElementById('modal-add').classList.add('hidden');
}

function setupAddModal() {
    const modal = document.getElementById('modal-add');
    const destRadios = modal.querySelectorAll('input[name="add-dest"]');
    const teamSelect = document.getElementById('add-team-select');

    destRadios.forEach(r => {
        r.addEventListener('change', () => {
            teamSelect.disabled = r.value !== 'team';
        });
    });

    document.getElementById('add-cancel').addEventListener('click', () => {
        closeAddModal();
    });

    document.getElementById('add-save').addEventListener('click', () => {
        const gameNick = document.getElementById('add-game-nick').value.trim();
        const twitchNick = document.getElementById('add-twitch-nick').value.trim();
        const rank = document.getElementById('add-rank').value;
        const games = parseInt(document.getElementById('add-games').value || '0', 10);

        const roles = Array.from(document.querySelectorAll('.add-role:checked')).map(cb => cb.value);

        if (!gameNick) {
            alert('Ник в игре обязателен');
            return;
        }

        const dest = Array.from(destRadios).find(r => r.checked).value;
        const player = {
            id: 'p_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            gameNick,
            twitchNick,
            rank,
            games,
            roles
        };

        if (dest === 'queue') {
            state.waiting.push(player);
        } else {
            const team = teamSelect.value;
            const freeIndex = state.teams[team].findIndex(p => p === null);
            if (freeIndex === -1) {
                alert('В выбранной команде нет свободных слотов');
                return;
            }
            state.teams[team][freeIndex] = player;
        }

        saveState();
        renderAll();
        closeAddModal();

        document.getElementById('add-game-nick').value = '';
        document.getElementById('add-twitch-nick').value = '';
        document.getElementById('add-games').value = '0';
        document.querySelectorAll('.add-role').forEach(cb => cb.checked = false);
    });
}

// ====== Модалка очистки ======

function openClearModal() {
    document.getElementById('modal-clear').classList.remove('hidden');
}

function closeClearModal() {
    document.getElementById('modal-clear').classList.add('hidden');
}

function setupClearModal() {
    document.getElementById('clear-cancel').addEventListener('click', () => {
        closeClearModal();
    });

    document.getElementById('clear-all').addEventListener('click', () => {
        clearAllLists();
        closeClearModal();
    });

    document.getElementById('clear-teams').addEventListener('click', () => {
        clearTeamsOnly();
        closeClearModal();
    });
}

// ====== Модалка редактирования игрока ======

function openEditModal(player, context) {
    editingContext = context;
    editingPlayer = player;

    document.getElementById('edit-game-nick').value = player.gameNick;
    document.getElementById('edit-twitch-nick').value = player.twitchNick;
    document.getElementById('edit-rank').value = player.rank;
    document.getElementById('edit-games').value = player.games;

    document.querySelectorAll('.edit-role').forEach(cb => {
        cb.checked = player.roles.includes(cb.value);
    });

    // выбор назначения
    const destRadios = document.querySelectorAll('input[name="edit-dest"]');
    destRadios.forEach(r => r.checked = false);
    const keepRadio = document.querySelector('input[name="edit-dest"][value="keep"]');
    if (keepRadio) keepRadio.checked = true;

    const teamSelect = document.getElementById('edit-team-select');
    const slotSelect = document.getElementById('edit-team-slot');
    if (teamSelect && slotSelect) {
        teamSelect.disabled = true;
        slotSelect.disabled = true;
    }

    document.getElementById('modal-edit').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('modal-edit').classList.add('hidden');
    editingContext = null;
    editingPlayer = null;
}

function setupEditModal() {
    const destRadios = document.querySelectorAll('input[name="edit-dest"]');
    const teamSelect = document.getElementById('edit-team-select');
    const slotSelect = document.getElementById('edit-team-slot');

    destRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (!teamSelect || !slotSelect) return;
            const val = r.value;
            if (val === 'team') {
                teamSelect.disabled = false;
                slotSelect.disabled = false;
            } else {
                teamSelect.disabled = true;
                slotSelect.disabled = true;
            }
        });
    });

    if (slotSelect) {
        slotSelect.innerHTML = '';
        TEAM_ROLES_ORDER.forEach((roleLabel, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = `${idx + 1}: ${roleLabel}`;
            slotSelect.appendChild(opt);
        });
    }

    document.getElementById('edit-cancel').addEventListener('click', () => {
        closeEditModal();
    });

    document.getElementById('edit-save').addEventListener('click', () => {
        if (!editingPlayer || !editingContext) return;

        editingPlayer.gameNick = document.getElementById('edit-game-nick').value.trim();
        editingPlayer.twitchNick = document.getElementById('edit-twitch-nick').value.trim();
        editingPlayer.rank = document.getElementById('edit-rank').value;
        editingPlayer.games = parseInt(document.getElementById('edit-games').value || '0', 10);
        editingPlayer.roles = Array.from(document.querySelectorAll('.edit-role:checked')).map(cb => cb.value);

        const dest = Array.from(document.querySelectorAll('input[name="edit-dest"]'))
            .find(r => r.checked)?.value || 'keep';

        if (dest === 'keep') {
            // уже отредактировали по ссылке
        } else if (dest === 'queue') {
            moveEditingPlayerToQueue();
        } else if (dest === 'team') {
            moveEditingPlayerToTeam();
        }

        saveState();
        renderAll();
        closeEditModal();
    });
}

function removeEditingPlayerFromSource() {
    if (!editingContext || !editingPlayer) return;

    if (editingContext.type === 'team') {
        const { team, slotIndex } = editingContext;
        if (state.teams[team][slotIndex] && state.teams[team][slotIndex].id === editingPlayer.id) {
            state.teams[team][slotIndex] = null;
        }
    } else if (editingContext.type === 'list') {
        const { list, index } = editingContext;
        if (state[list][index] && state[list][index].id === editingPlayer.id) {
            state[list].splice(index, 1);
        } else {
            const idx = state[list].findIndex(p => p.id === editingPlayer.id);
            if (idx !== -1) state[list].splice(idx, 1);
        }
    }
}

function moveEditingPlayerToQueue() {
    if (!editingPlayer) return;

    if (editingContext.type === 'list' && editingContext.list === 'waiting') {
        return;
    }

    removeEditingPlayerFromSource();
    state.waiting.push(editingPlayer);
}

function moveEditingPlayerToTeam() {
    if (!editingPlayer) return;

    const teamSelect = document.getElementById('edit-team-select');
    const slotSelect = document.getElementById('edit-team-slot');
    if (!teamSelect || !slotSelect) return;

    const team = teamSelect.value;
    const slotIndex = parseInt(slotSelect.value, 10);

    if (!state.teams[team]) {
        alert('Неверная команда');
        return;
    }
    if (slotIndex < 0 || slotIndex >= state.teams[team].length) {
        alert('Неверный слот');
        return;
    }
    if (state.teams[team][slotIndex] && state.teams[team][slotIndex].id !== editingPlayer.id) {
        alert('Этот слот уже занят другим игроком');
        return;
    }

    removeEditingPlayerFromSource();
    state.teams[team][slotIndex] = editingPlayer;
}

// ====== Инициализация ======

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderAll();

    document.getElementById('btn-inc-games').addEventListener('click', incrementGamesInTeams);
    document.getElementById('btn-clear-lists').addEventListener('click', openClearModal);
    document.getElementById('btn-add-player').addEventListener('click', openAddModal);

    setupAddModal();
    setupClearModal();
    setupEditModal();
});
