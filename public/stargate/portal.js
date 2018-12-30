var portalTarget = '';

function doTeleport() {
    var el = document.querySelector('#portalcircle');

    window.Alt.HtmlView.FollowAltspaceLink(portalTarget);
}

function spawnPortal(target) {
    var portalEl = document.createElement('a-circle');
    portalEl.setAttribute('id', 'portalcircle');
    portalEl.setAttribute('color', '#8888CC');
    portalEl.setAttribute('radius', '2.6');
    portalEl.setAttribute('rotation', '0 0 0');
    portalEl.setAttribute('position', '0 0 0');
    portalEl.setAttribute('portal', '');

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portalEl);

    portalTarget = 'altspace://account.altvr.com/api/spaces/' + target;
}

function despawnPortal() {
    var sceneEl = document.querySelector('a-scene');
    var portalEl = document.querySelector('#portalcircle');

    sceneEl.removeChild(portalEl);
}

function sendInitMessage(socket) {
    socket.send(JSON.stringify({ name: 'stargate', url: document.URL }));
}

function receiveCommand(message) {
    try {
        var json = JSON.parse(message.data);
    } catch (e) {
        console.log('Invalid JSON: ', message.data);
        return;
    }
    
    if(json.command === 'engage') {
        console.log(`Received command: Engage to ${json.location}`);
        spawnPortal(json.location);
    } else if(json.command === 'disengage') {
        console.log(`Received command: Disengage`);
        despawnPortal();
    }
}

function recoverFrom(baseUrl) {
    var portalEl = document.createElement('a-circle');
    portalEl.setAttribute('id', 'iris');
    portalEl.setAttribute('color', '#222222');
    portalEl.setAttribute('radius', '2.6');
    portalEl.setAttribute('rotation', '0 0 0');
    portalEl.setAttribute('position', '0 0 0');

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portalEl);

    setTimeout(openConnection(baseUrl), 5000);
}

function openConnection(baseurl) {
    var sceneEl = document.querySelector('a-scene');
    var portalEl = document.querySelector('#iris');

    if (portalEl) sceneEl.removeChild(portalEl);

    var controlSocket = new WebSocket(baseurl + '/control');
    controlSocket.onopen = () => sendInitMessage(controlSocket);
    controlSocket.onmessage = (message) => receiveCommand(message);
    controlSocket.onerror = (ev) => recoverfrom(baseurl);
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
