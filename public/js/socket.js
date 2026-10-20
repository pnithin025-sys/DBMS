// =====================================================================
// PIXORA CLIENT SOCKET.IO HANDLER
// =====================================================================

let socket = null;

function initClientSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.IO script not loaded');
        return;
    }

    if (socket) return socket;

    socket = io({
        withCredentials: true
    });

    socket.on('connect', () => {
        console.log('[Socket.IO] Connected to Pixora live server');
    });

    socket.on('new_message_alert', (data) => {
        // Trigger live message notification badge
        const badge = document.getElementById('msg-badge-counter');
        if (badge) {
            const count = parseInt(badge.textContent || '0', 10) + 1;
            badge.textContent = count;
            badge.style.display = 'inline-block';
        }
        if (window.showToast) {
            window.showToast(`New message from @${data.message.sender_username}`, 'info');
        }
    });

    return socket;
}

window.initClientSocket = initClientSocket;
window.getSocket = () => socket;
