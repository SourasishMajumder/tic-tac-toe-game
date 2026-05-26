/* ==========================================================================
   NEON TOES - GAME CONTROLLER (JAVASCRIPT)
   Full-stack Retro Arcade Tic Tac Toe Logic & AI
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. Audio Synthesizer (Retro Arcade Sound Pack)
   -------------------------------------------------------------------------- */
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            // Lazy load audio context on first user input to satisfy browser guidelines
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playClick() {
        if (!this.enabled || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    playWin() {
        if (!this.enabled || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        const playTone = (freq, startTime, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.exponentialRampToValueAtTime(0.005, startTime + duration);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        // Rising retro synthesized arpeggio
        playTone(261.63, now, 0.12);        // C4
        playTone(329.63, now + 0.10, 0.12); // E4
        playTone(392.00, now + 0.20, 0.12); // G4
        playTone(523.25, now + 0.30, 0.35); // C5
    }

    playDraw() {
        if (!this.enabled || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        
        osc1.frequency.setValueAtTime(140, now);
        osc1.frequency.linearRampToValueAtTime(80, now + 0.35);
        
        osc2.frequency.setValueAtTime(137, now);
        osc2.frequency.linearRampToValueAtTime(77, now + 0.35);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
    }
}

/* --------------------------------------------------------------------------
   2. Game Controller Setup
   -------------------------------------------------------------------------- */
class NeonToeGame {
    constructor() {
        // Game state variables
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X'; // Player X always starts
        this.gameMode = 'pvp'; // 'pvp' or 'pve' (Player vs Comp)
        this.difficulty = 'hard'; // 'easy' or 'hard' (minimax)
        this.isGameActive = true;
        this.isAiMoving = false;
        
        // Scores
        this.scores = {
            player_x: 0,
            player_o: 0,
            draws: 0
        };

        // Sound controller
        this.sounds = new SoundEffects();

        // Target winning combinations
        this.winningCombos = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        // Cache DOM elements
        this.cacheDom();
        // Setup events
        this.bindEvents();
        // Load persistent scores from server
        this.loadScores();
    }

    cacheDom() {
        this.dom = {
            cells: document.querySelectorAll('.cell'),
            board: document.getElementById('board'),
            turnIndicator: document.getElementById('turn-indicator'),
            soundToggle: document.getElementById('sound-toggle'),
            soundOnIcon: document.getElementById('sound-on-icon'),
            soundOffIcon: document.getElementById('sound-off-icon'),
            
            // Score values
            scoreX: document.getElementById('score-val-x'),
            scoreO: document.getElementById('score-val-o'),
            scoreDraw: document.getElementById('score-val-draw'),
            playerOLabel: document.getElementById('player-o-label'),
            
            // Mode selectors
            modePvp: document.getElementById('mode-pvp'),
            modePve: document.getElementById('mode-pve'),
            difficultySetting: document.getElementById('difficulty-setting'),
            diffEasy: document.getElementById('diff-easy'),
            diffHard: document.getElementById('diff-hard'),
            
            // Buttons
            resetBoard: document.getElementById('reset-board-btn'),
            resetScores: document.getElementById('reset-scores-btn'),
            
            // Modal
            modal: document.getElementById('result-modal'),
            modalWinner: document.getElementById('modal-winner-symbol'),
            modalTitle: document.getElementById('modal-title'),
            modalSubtitle: document.getElementById('modal-subtitle'),
            modalPlayAgain: document.getElementById('modal-play-again-btn')
        };
    }

    bindEvents() {
        // Cell interactions
        this.dom.cells.forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });

        // Mode and config selections
        this.dom.modePvp.addEventListener('click', () => this.setGameMode('pvp'));
        this.dom.modePve.addEventListener('click', () => this.setGameMode('pve'));
        this.dom.diffEasy.addEventListener('click', () => this.setDifficulty('easy'));
        this.dom.diffHard.addEventListener('click', () => this.setDifficulty('hard'));

        // Reset functions
        this.dom.resetBoard.addEventListener('click', () => this.resetBoard());
        this.dom.resetScores.addEventListener('click', () => this.resetScores());
        this.dom.modalPlayAgain.addEventListener('click', () => {
            this.closeModal();
            this.resetBoard();
        });

        // Sound Toggle
        this.dom.soundToggle.addEventListener('click', () => this.toggleSound());
    }

    /* --------------------------------------------------------------------------
       3. Sounds & API Server Interaction
       -------------------------------------------------------------------------- */
    toggleSound() {
        this.sounds.enabled = !this.sounds.enabled;
        
        if (this.sounds.enabled) {
            this.sounds.init();
            this.dom.soundOnIcon.classList.remove('hidden');
            this.dom.soundOffIcon.classList.add('hidden');
            this.sounds.playClick();
        } else {
            this.dom.soundOnIcon.classList.add('hidden');
            this.dom.soundOffIcon.classList.remove('hidden');
        }
    }

    async loadScores() {
        try {
            const response = await fetch('api.php?action=get_scores');
            if (response.ok) {
                const scores = await response.json();
                this.scores = scores;
                this.updateScoreboardUI();
            }
        } catch (error) {
            console.warn("Could not load scores from API, using client-side defaults. Make sure you run index.html on a local server with PHP enabled.", error);
        }
    }

    async updateBackendScores(winner) {
        try {
            const response = await fetch('api.php?action=update_scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ winner: winner })
            });
            if (response.ok) {
                const updatedScores = await response.json();
                this.scores = updatedScores;
                this.updateScoreboardUI();
            }
        } catch (error) {
            // Local fallback if PHP is not available
            if (winner === 'X') this.scores.player_x++;
            if (winner === 'O') this.scores.player_o++;
            if (winner === 'draw') this.scores.draws++;
            if (winner === 'reset') this.scores = { player_x: 0, player_o: 0, draws: 0 };
            
            this.updateScoreboardUI();
            console.warn("Could not save scores to backend (local fallback active).", error);
        }
    }

    updateScoreboardUI() {
        this.dom.scoreX.textContent = this.scores.player_x;
        this.dom.scoreO.textContent = this.scores.player_o;
        this.dom.scoreDraw.textContent = this.scores.draws;
    }

    /* --------------------------------------------------------------------------
       4. Settings Configurations
       -------------------------------------------------------------------------- */
    setGameMode(mode) {
        if (this.gameMode === mode) return;
        this.sounds.playClick();
        
        this.gameMode = mode;
        
        if (mode === 'pvp') {
            this.dom.modePvp.classList.add('active');
            this.dom.modePve.classList.remove('active');
            this.dom.difficultySetting.classList.remove('show-fade');
            this.dom.playerOLabel.textContent = "Player O";
        } else {
            this.dom.modePvp.classList.remove('active');
            this.dom.modePve.classList.add('active');
            this.dom.difficultySetting.classList.add('show-fade');
            this.dom.playerOLabel.textContent = "Computer";
        }
        
        this.resetBoard();
    }

    setDifficulty(diff) {
        if (this.difficulty === diff) return;
        this.sounds.playClick();
        
        this.difficulty = diff;
        
        if (diff === 'easy') {
            this.dom.diffEasy.classList.add('active');
            this.dom.diffHard.classList.remove('active');
        } else {
            this.dom.diffEasy.classList.remove('active');
            this.dom.diffHard.classList.add('active');
        }
        
        this.resetBoard();
    }

    /* --------------------------------------------------------------------------
       5. Game Play Flow & Actions
       -------------------------------------------------------------------------- */
    handleCellClick(e) {
        const cell = e.target;
        const cellIndex = parseInt(cell.getAttribute('data-index'));

        // Prevent clicking during AI thinking, occupied cells, or inactive game
        if (this.board[cellIndex] !== null || !this.isGameActive || this.isAiMoving) {
            return;
        }

        // Initialize audio on first click (autoplay browser friendly)
        this.sounds.init();
        
        this.makeMove(cellIndex, this.currentPlayer);
    }

    makeMove(index, player) {
        this.board[index] = player;
        
        const cell = document.getElementById(`cell-${index}`);
        cell.textContent = player;
        cell.classList.add(player === 'X' ? 'x-cell' : 'o-cell');
        
        this.sounds.playClick();

        // Check if current move resulted in win or draw
        if (this.checkWin(this.board, player)) {
            this.handleGameEnd(player);
        } else if (this.checkDraw(this.board)) {
            this.handleGameEnd('draw');
        } else {
            // Switch Turn
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            this.updateTurnIndicator();

            // Handle computer's AI move if vs Computer
            if (this.gameMode === 'pve' && this.currentPlayer === 'O' && this.isGameActive) {
                this.isAiMoving = true;
                setTimeout(() => this.triggerAiMove(), 400); // realistic short delay
            }
        }
    }

    updateTurnIndicator() {
        if (this.gameMode === 'pvp') {
            this.dom.turnIndicator.innerHTML = `Player <span class="${this.currentPlayer === 'X' ? 'x-highlight' : 'o-highlight'}">${this.currentPlayer}</span>'s Turn`;
        } else {
            if (this.currentPlayer === 'X') {
                this.dom.turnIndicator.innerHTML = `Your <span class="x-highlight">Turn</span>`;
            } else {
                this.dom.turnIndicator.innerHTML = `Computer is <span class="o-highlight">Thinking...</span>`;
            }
        }
    }

    triggerAiMove() {
        let bestMoveIndex;
        
        if (this.difficulty === 'easy') {
            bestMoveIndex = this.getEasyAiMove();
        } else {
            bestMoveIndex = this.getBestMoveMinimax();
        }

        this.isAiMoving = false;
        if (bestMoveIndex !== null && bestMoveIndex !== undefined) {
            this.makeMove(bestMoveIndex, 'O');
        }
    }

    getEasyAiMove() {
        // Random move picker among remaining available empty cell locations
        const emptyIndices = [];
        this.board.forEach((val, idx) => {
            if (val === null) emptyIndices.push(idx);
        });
        if (emptyIndices.length === 0) return null;
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    /* --------------------------------------------------------------------------
       6. Unbeatable Minimax AI Engine (O matches Computer, X matches Player)
       -------------------------------------------------------------------------- */
    getBestMoveMinimax() {
        let bestScore = -Infinity;
        let bestMove = null;

        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                // Try move
                this.board[i] = 'O';
                let score = this.minimax(this.board, 0, false);
                // Undo move
                this.board[i] = null;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        return bestMove;
    }

    minimax(tempBoard, depth, isMaximizing) {
        // Base evaluations
        if (this.checkWin(tempBoard, 'O')) return 10 - depth; // Computer wins (maximize), subtract depth to reward quicker victories
        if (this.checkWin(tempBoard, 'X')) return depth - 10; // Opponent wins (minimize), add depth to delay inevitable defeat
        if (this.checkDraw(tempBoard)) return 0;

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (tempBoard[i] === null) {
                    tempBoard[i] = 'O';
                    let score = this.minimax(tempBoard, depth + 1, false);
                    tempBoard[i] = null;
                    maxScore = Math.max(maxScore, score);
                }
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (tempBoard[i] === null) {
                    tempBoard[i] = 'X';
                    let score = this.minimax(tempBoard, depth + 1, true);
                    tempBoard[i] = null;
                    minScore = Math.min(minScore, score);
                }
            }
            return minScore;
        }
    }

    checkWin(tempBoard, player) {
        return this.winningCombos.some(combo => {
            return combo.every(idx => tempBoard[idx] === player);
        });
    }

    checkDraw(tempBoard) {
        return tempBoard.every(cell => cell !== null);
    }

    /* --------------------------------------------------------------------------
       7. Game Over Announcements & Reset
       -------------------------------------------------------------------------- */
    handleGameEnd(result) {
        this.isGameActive = false;
        
        if (result === 'draw') {
            // Draw
            this.sounds.playDraw();
            this.updateBackendScores('draw');
            
            // Show modal
            this.dom.modalWinner.textContent = "½";
            this.dom.modalWinner.className = "winner-symbol draw-win";
            this.dom.modalTitle.textContent = "Round Draw!";
            this.dom.modalTitle.className = "modal-heading gold-text";
            this.dom.modalSubtitle.textContent = "An evenly matched pixel warfare.";
        } else {
            // Player won
            this.sounds.playWin();
            this.updateBackendScores(result);
            
            // Highlight winner combo cells
            const winningCombo = this.winningCombos.find(combo => {
                return combo.every(idx => this.board[idx] === result);
            });
            if (winningCombo) {
                winningCombo.forEach(idx => {
                    document.getElementById(`cell-${idx}`).classList.add('win-highlight');
                });
            }

            // Custom UI elements
            this.dom.modalWinner.textContent = result;
            if (result === 'X') {
                this.dom.modalWinner.className = "winner-symbol x-win";
                this.dom.modalTitle.textContent = "Victory!";
                this.dom.modalTitle.className = "modal-heading cyan-text";
                this.dom.modalSubtitle.textContent = this.gameMode === 'pve' ? "You conquered the machine!" : "Player X dominates the grid.";
            } else {
                this.dom.modalWinner.className = "winner-symbol o-win";
                this.dom.modalTitle.textContent = "Defeat!";
                this.dom.modalTitle.className = "modal-heading magenta-text";
                this.dom.modalSubtitle.textContent = this.gameMode === 'pve' ? "The computer is mathematically superior." : "Player O takes the crown.";
            }
        }

        // Show game end popup overlay
        setTimeout(() => this.openModal(), 600);
    }

    openModal() {
        this.dom.modal.classList.remove('hidden');
        // Trigger repaint to enable CSS transition
        void this.dom.modal.offsetWidth;
        this.dom.modal.classList.add('show');
    }

    closeModal() {
        this.dom.modal.classList.remove('show');
        setTimeout(() => {
            this.dom.modal.classList.add('hidden');
        }, 300);
    }

    resetBoard() {
        this.sounds.playClick();
        
        // Reset local variables
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.isGameActive = true;
        this.isAiMoving = false;
        
        // Reset DOM elements
        this.dom.cells.forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
        });

        this.updateTurnIndicator();
    }

    resetScores() {
        this.sounds.playClick();
        if (confirm("Are you sure you want to completely reset the scoreboard data?")) {
            this.updateBackendScores('reset');
        }
    }
}

// Instantiate game instance on content loaded
document.addEventListener('DOMContentLoaded', () => {
    new NeonToeGame();
});
