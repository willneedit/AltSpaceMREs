var _controlSocket;

async function sock_heartbeat(socket) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ name: 'hb'}));

        // Send half-minute heartbeats as long as we're alive
        setTimeout(() => sock_heartbeat(socket), 30 * 1000);
    }
}

async function sock_initialized(socket) {
    sendInitMessage(socket);

    sock_heartbeat(socket);
    _controlSocket = socket;
}

function sock_receive(message) {
    try {
        var json = JSON.parse(message.data);
    } catch (e) {
        console.debug('Invalid JSON: ', message.data);
        return;
    }
    
    processCommand(json);
}

function sock_recover(baseUrl) {
    setTimeout(openConnection(baseUrl), 10000);
}

function sock_init() {
    var baseurl = document.origin || document.location.origin;
    baseurl = baseurl.replace('http://', 'ws://');
    baseurl = baseurl.replace('https://', 'wss://');

    var controlSocket = new WebSocket(baseurl + '/control');
    controlSocket.onopen = () => sock_initialized(controlSocket);
    controlSocket.onmessage = (message) => sock_receive(message);
    controlSocket.onclose = () => sock_recover(baseurl);
}
