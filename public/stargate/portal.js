var portalTarget = '';
var horizonSize = 2.6;

function doTeleport() {
    window.Alt.HtmlView.FollowAltspaceLink(portalTarget);
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), milliseconds);
    });
}

async function spawnPortal(target) {
    portalTarget = 'altspace://account.altvr.com/api/spaces/' + target;

    var portal1El = document.createElement('a-circle');
    portal1El.setAttribute('id', 'portalcircle1');
    portal1El.setAttribute('material', 'src: #portaldisc; opacity: 0.0');
    portal1El.setAttribute('radius', horizonSize);
    portal1El.setAttribute('position', '0 0 -0.1');
    portal1El.setAttribute('portal', '');

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portal1El);
}

async function despawnPortal() {
    var sceneEl = document.querySelector('a-scene');
    var portal1El = document.querySelector('#portalcircle1');

    sceneEl.removeChild(portal1El);
}

async function socketHeartbeat(socket) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ name: 'hb'}));

        // Send half-minute heartbeats as long as we're alive
        setTimeout(() => socketHeartbeat(socket), 30 * 1000);
    }
}

async function sendInitMessage(socket) {
    var user = await altspace.getUser();
    var space = await altspace.getSpace();
    socket.send(JSON.stringify({ name: 'stargate', 
        url: document.URL,
        sid: space.sid,
        userId: user.userId,
        userName: user.displayName
    }));

    socketHeartbeat(socket);
}

function receiveCommand(message) {
    try {
        var json = JSON.parse(message.data);
    } catch (e) {
        console.debug('Invalid JSON: ', message.data);
        return;
    }
    
    if(json.command === 'size=') {
        console.debug(`Received command: size=${json.size}`);
        horizonSize = 2.6 * json.size;
    } else if(json.command === 'engage') {
        console.debug(`Received command: Engage to ${json.location}`);
        spawnPortal(json.location);
    } else if(json.command === 'disengage') {
        console.debug(`Received command: Disengage`);
        despawnPortal();
    }
}

function recoverFrom(baseUrl) {
    var portalEl = document.createElement('a-circle');
    portalEl.setAttribute('id', 'iris');
    portalEl.setAttribute('color', '#222222');
    portalEl.setAttribute('radius', horizonSize);
    portalEl.setAttribute('position', '0 0 0');

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portalEl);

    setTimeout(openConnection(baseUrl), 10000);
}

function openConnection(baseurl) {
    var sceneEl = document.querySelector('a-scene');
    var portalEl = document.querySelector('#iris');

    if (portalEl) sceneEl.removeChild(portalEl);

    var controlSocket = new WebSocket(baseurl + '/control');
    controlSocket.onopen = () => sendInitMessage(controlSocket);
    controlSocket.onmessage = (message) => receiveCommand(message);
    // controlSocket.onerror = (ev) => recoverFrom(baseurl);
    controlSocket.onclose = () => recoverFrom(baseurl);
}

function main() {
    var baseurl = document.origin;
    baseurl = baseurl.replace('http://', 'ws://');
    baseurl = baseurl.replace('https://', 'ws://');

    AFRAME.registerComponent('portal', {
        schema: {},
        init: function(){
            this.el.addEventListener('click', () => doTeleport());
        }
    });

    openConnection(baseurl);
}

main();
