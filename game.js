// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.viewport = { x: 0, y: 0, width: 0, height: 0 };
        
        // Input state
        this.keysPressed = {
            up: false,
            down: false,
            left: false,
            right: false,
            space: false
        };
        this.isMoving = false;
        this.currentDirection = null;
        this.movementInterval = null;
        
        // Jump animation state
        this.jumpAnimation = {
            isJumping: false,
            jumpHeight: 0,
            jumpDuration: 300, // milliseconds
            jumpStartTime: 0
        };
        
        // Avatar image cache
        this.avatarImageCache = {};
        
        // WebSocket connection
        this.socket = null;
        this.connectionState = 'disconnected';
        
        this.init();
    }
    
    updateUI() {
        // Update connection status
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            switch (this.connectionState) {
                case 'connecting':
                    statusElement.textContent = 'Connecting...';
                    statusElement.style.color = '#ffa500';
                    break;
                case 'connected':
                    statusElement.textContent = 'Connected';
                    statusElement.style.color = '#00ff00';
                    break;
                case 'disconnected':
                    statusElement.textContent = 'Disconnected';
                    statusElement.style.color = '#ff0000';
                    break;
                case 'error':
                    statusElement.textContent = 'Connection Error';
                    statusElement.style.color = '#ff0000';
                    break;
            }
        }
        
        // Update player count
        const playerCountElement = document.getElementById('player-count');
        if (playerCountElement) {
            const playerCount = Object.keys(this.players).length;
            playerCountElement.textContent = `Players: ${playerCount}`;
        }
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupInput();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update viewport dimensions
        this.viewport.width = this.canvas.width;
        this.viewport.height = this.canvas.height;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.viewport.width = this.canvas.width;
            this.viewport.height = this.canvas.height;
            this.centerViewportOnPlayer();
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            // Don't draw yet - wait for server response with player data
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupInput() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Prevent default behavior for arrow keys and spacebar to avoid page scrolling
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // WebSocket connection methods
    connectToServer() {
        try {
            this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
            this.connectionState = 'connecting';
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.connectionState = 'connected';
                this.updateUI();
                this.joinGame();
            };
            
            this.socket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from game server');
                this.connectionState = 'disconnected';
                this.updateUI();
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (this.connectionState === 'disconnected') {
                        this.connectToServer();
                    }
                }, 3000);
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.connectionState = 'error';
                this.updateUI();
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.connectionState = 'error';
        }
    }
    
    joinGame() {
        if (this.connectionState !== 'connected') return;
        
        const joinMessage = {
            action: 'join_game',
            username: 'Surya'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    sendMoveCommand(direction) {
        if (this.connectionState !== 'connected') return;
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.socket.send(JSON.stringify(moveMessage));
    }
    
    sendStopCommand() {
        if (this.connectionState !== 'connected') return;
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.socket.send(JSON.stringify(stopMessage));
    }
    
    startJumpAnimation() {
        if (this.jumpAnimation.isJumping) return; // Don't jump while already jumping
        
        this.jumpAnimation.isJumping = true;
        this.jumpAnimation.jumpStartTime = Date.now();
        this.jumpAnimation.jumpHeight = 0;
        
        // Start jump animation loop
        this.animateJump();
    }
    
    animateJump() {
        if (!this.jumpAnimation.isJumping) return;
        
        const elapsed = Date.now() - this.jumpAnimation.jumpStartTime;
        const progress = Math.min(elapsed / this.jumpAnimation.jumpDuration, 1);
        
        // Create a smooth jump curve (parabolic)
        const jumpCurve = 4 * progress * (1 - progress); // Creates a nice arc
        this.jumpAnimation.jumpHeight = jumpCurve * 20; // Max jump height of 20 pixels
        
        if (progress < 1) {
            // Continue animation
            requestAnimationFrame(() => this.animateJump());
        } else {
            // End jump animation
            this.jumpAnimation.isJumping = false;
            this.jumpAnimation.jumpHeight = 0;
        }
        
        // Redraw to show animation
        this.draw();
    }
    
    startContinuousMovement() {
        // Clear any existing movement interval
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
        }
        
        // Start sending move commands repeatedly
        this.movementInterval = setInterval(() => {
            // Send move command for the current direction
            if (this.currentDirection) {
                this.sendMoveCommand(this.currentDirection);
            }
        }, 100); // Send move command every 100ms
    }
    
    stopContinuousMovement() {
        // Clear the movement interval
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
    }
    
    preloadAvatarImages(avatarName, avatarData) {
        const cacheKey = avatarName;
        this.avatarImageCache[cacheKey] = {};
        
        let loadedCount = 0;
        const totalFrames = Object.values(avatarData.frames).reduce((sum, frames) => sum + frames.length, 0);
        
        // Preload all frames for all directions
        Object.keys(avatarData.frames).forEach(direction => {
            this.avatarImageCache[cacheKey][direction] = [];
            
            avatarData.frames[direction].forEach((frameData, index) => {
                const img = new Image();
                img.onload = () => {
                    this.avatarImageCache[cacheKey][direction][index] = img;
                    loadedCount++;
                    
                    // Redraw when all images are loaded
                    if (loadedCount === totalFrames) {
                        console.log(`All avatar images loaded for ${avatarName}`);
                        this.draw();
                    }
                };
                img.src = frameData;
            });
        });
    }
    
    handleKeyDown(e) {
        // Handle spacebar for jump
        if (e.key === ' ' && !this.keysPressed.space) {
            this.keysPressed.space = true;
            this.startJumpAnimation();
            return;
        }
        
        // Map arrow keys to directions
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = keyMap[e.key];
        if (direction && !this.keysPressed[direction]) {
            this.keysPressed[direction] = true;
            
            // Send initial move command
            this.sendMoveCommand(direction);
            
            // Start continuous movement
            this.isMoving = true;
            this.currentDirection = direction;
            this.startContinuousMovement();
        }
    }
    
    handleKeyUp(e) {
        // Handle spacebar release
        if (e.key === ' ') {
            this.keysPressed.space = false;
            return;
        }
        
        // Map arrow keys to directions
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = keyMap[e.key];
        if (direction) {
            this.keysPressed[direction] = false;
            this.checkForStop();
        }
    }
    
    checkForStop() {
        // Check if any keys are still pressed
        const anyKeyPressed = Object.values(this.keysPressed).some(pressed => pressed);
        
        if (!anyKeyPressed && this.isMoving) {
            // Stop continuous movement
            this.stopContinuousMovement();
            this.sendStopCommand();
            this.isMoving = false;
            this.currentDirection = null;
        }
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    
                    // Preload all avatar images
                    Object.keys(message.avatars).forEach(avatarName => {
                        this.preloadAvatarImages(avatarName, message.avatars[avatarName]);
                    });
                    
                    this.centerViewportOnPlayer();
                    this.updateUI();
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                
                // Preload new avatar images
                this.preloadAvatarImages(message.avatar.name, message.avatar);
                
                this.updateUI();
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                // Update viewport to follow our player
                this.centerViewportOnPlayer();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.updateUI();
                this.draw();
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    // Viewport and rendering methods
    centerViewportOnPlayer() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        
        // Center viewport on player
        this.viewport.x = myPlayer.x - this.viewport.width / 2;
        this.viewport.y = myPlayer.y - this.viewport.height / 2;
        
        // Clamp viewport to world boundaries
        this.viewport.x = Math.max(0, Math.min(this.viewport.x, this.worldWidth - this.viewport.width));
        this.viewport.y = Math.max(0, Math.min(this.viewport.y, this.worldHeight - this.viewport.height));
    }
    
    draw() {
        // Only draw if we have both the world image and player data
        if (!this.worldImage || !this.myPlayerId) return;
        
        // Ensure viewport is centered on player before rendering
        this.centerViewportOnPlayer();
        
        this.drawWorld();
        this.drawAvatars();
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map using viewport coordinates
        this.ctx.drawImage(
            this.worldImage,
            this.viewport.x, this.viewport.y, // source x, y (viewport position on world map)
            this.viewport.width, this.viewport.height, // source width, height
            0, 0, // destination x, y (start from upper left of canvas)
            this.viewport.width, this.viewport.height // destination width, height
        );
    }
    
    drawAvatars() {
        Object.values(this.players).forEach(player => {
            this.drawAvatar(player);
        });
    }
    
    drawAvatar(player) {
        if (!this.avatars[player.avatar]) return;
        
        const avatarSize = 48; // Avatar size in pixels (increased from 32)
        
        // Calculate screen position (world position - viewport offset)
        const screenX = player.x - this.viewport.x;
        let screenY = player.y - this.viewport.y;
        
        // Apply jump animation offset for our player
        if (player.id === this.myPlayerId && this.jumpAnimation.isJumping) {
            screenY -= this.jumpAnimation.jumpHeight;
        }
        
        // Only draw if avatar is visible on screen
        if (screenX < -avatarSize || screenX > this.viewport.width + avatarSize ||
            screenY < -avatarSize || screenY > this.viewport.height + avatarSize) {
            return;
        }
        
        // Get cached image from preloaded cache
        const cachedAvatar = this.avatarImageCache[player.avatar];
        if (!cachedAvatar) {
            console.log(`Avatar cache not found for: ${player.avatar}`);
            return;
        }
        
        const direction = player.facing || 'south';
        const frameIndex = player.animationFrame || 0;
        const cachedFrames = cachedAvatar[direction];
        
        if (!cachedFrames) {
            console.log(`No cached frames for direction: ${direction}`);
            return;
        }
        
        if (!cachedFrames[frameIndex]) {
            console.log(`No cached frame at index ${frameIndex} for direction ${direction}`);
            return;
        }
        
        if (cachedFrames && cachedFrames[frameIndex]) {
            const img = cachedFrames[frameIndex];
            
            // Draw avatar shadow
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(
                screenX - avatarSize / 2 + 2, screenY - avatarSize / 2 + 2,
                avatarSize, avatarSize
            );
            this.ctx.globalAlpha = 1.0;
            this.ctx.restore();
            
            // Draw avatar image (synchronously)
            this.ctx.drawImage(
                img,
                screenX - avatarSize / 2, screenY - avatarSize / 2,
                avatarSize, avatarSize
            );
            
            // Draw username label with better styling
            this.ctx.save();
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            
            // Username background
            const textWidth = this.ctx.measureText(player.username).width;
            const labelY = screenY - avatarSize / 2 - 8;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(
                screenX - textWidth / 2 - 4, labelY - 16,
                textWidth + 8, 18
            );
            
            // Username text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeText(player.username, screenX, labelY);
            this.ctx.fillText(player.username, screenX, labelY);
            this.ctx.restore();
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
