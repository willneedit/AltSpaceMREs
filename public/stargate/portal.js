window.AudioContext = window.AudioContext || window.webkitAudioContext;

var portalTarget = '';
var sounds = { };

function loadSound(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function()
    {
        if(xhr.status === 200 || xhr.status === 304){
            sounds.ctx.decodeAudioData(xhr.response,
                function(buffer){
                    var gainNode = sounds.ctx.createGain();
                    gainNode.connect(sounds.masterVol);
                    cb(buffer, gainNode);
                },
                function(err){
                    console.error('Failed to decode audio', url, err);
                }
            );
        }
    };
    xhr.send();
}

function loadSounds() {
    // set up sound subsystem
    sounds.ctx = new AudioContext();
    sounds.masterVol = sounds.ctx.createGain();
    sounds.masterVol.connect(sounds.ctx.destination);
    sounds.masterVol.gain.value = 0.25;

    loadSound('https://willneedit.github.io/MRE/stargate/SG_Chevron_lock.wav', function(source, volumeControl)
    {
        sounds.chevronLock = source;
        sounds.chevronLockVol = volumeControl;
    });

    loadSound('https://willneedit.github.io/MRE/stargate/SG_Turn_Grind.wav', function(source, volumeControl)
    {
        sounds.turnGrind = source;
        sounds.turnGrindVol = volumeControl;
        sounds.turnGrind.loop = true;
    });

    loadSound('https://willneedit.github.io/MRE/stargate/SG_Vortex_Formation.wav', function(source, volumeControl)
    {
        sounds.vortexForm = source;
        sounds.vortexFormVol = volumeControl;
    });

}

var playingSound = null;

sounds.playSound = function(soundName)
{
    if (playingSound !== null) {
        playingSound.stop();
    }

    var source = sounds.ctx.createBufferSource();
    source.buffer = sounds[soundName];
    source.connect( sounds[soundName+'Vol'] );
    if (sounds[soundName].loop) source.loop = true;


    source.start(0);
    playingSound = source;
}

sounds.stopSound = function()
{
    if (playingSound !== null) {
        playingSound.stop();
    }

    playingSound = null;

}

function doTeleport() {
    window.Alt.HtmlView.FollowAltspaceLink(portalTarget);
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), milliseconds);
    });
}

async function flashPortal() {
    var portalFlashEl = document.createElement('a-circle');
    portalFlashEl.setAttribute('material', 'opacity: 0');
    portalFlashEl.setAttribute('radius', '2.6');
    portalFlashEl.setAttribute('position', '0 0 0.1');

    var portalFlashAnimEl = document.createElement('a-animation');
    portalFlashAnimEl.setAttribute('attribute', 'material.opacity');
    portalFlashAnimEl.setAttribute('dur', '1000');
    portalFlashAnimEl.setAttribute('from', '0');
    portalFlashAnimEl.setAttribute('to', '1');
    portalFlashAnimEl.setAttribute('repeat', '1');
    portalFlashAnimEl.setAttribute('direction', 'alternate');
    portalFlashEl.appendChild(portalFlashAnimEl);

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portalFlashEl);
    sounds.playSound('vortexForm');

    setTimeout( () => sceneEl.removeChild(portalFlashEl), 2000);

    await delay(1000);
}

async function startTurning() {
    sounds.playSound('turnGrind');
}

async function chevronLock() {
    sounds.playSound('chevronLock');
}

async function spawnPortal(target) {
    portalTarget = 'altspace://account.altvr.com/api/spaces/' + target;

    await flashPortal();

    var portal1El = document.createElement('a-circle');
    portal1El.setAttribute('id', 'portalcircle1');
    portal1El.setAttribute('material', 'src: #portaldisc');
    portal1El.setAttribute('radius', '2.6');
    portal1El.setAttribute('position', '0 0 -0.1');

    var portal1AnimationEl = document.createElement('a-animation');
    portal1AnimationEl.setAttribute('attribute', 'rotation');
    portal1AnimationEl.setAttribute('dur', '20000');
    portal1AnimationEl.setAttribute('to', '0 0 360');
    portal1AnimationEl.setAttribute('easing', 'linear');
    portal1AnimationEl.setAttribute('repeat', 'indefinite');
    portal1El.appendChild(portal1AnimationEl);

    var portal2El = document.createElement('a-circle');
    portal2El.setAttribute('id', 'portalcircle2');
    portal2El.setAttribute('material', 'src: #portaldisc_detail; opacity: 0.5');
    portal2El.setAttribute('radius', '2.6');
    portal2El.setAttribute('position', '0 0 0');
    portal2El.setAttribute('portal', '');

    var portal2AnimationEl = document.createElement('a-animation');
    portal2AnimationEl.setAttribute('attribute', 'rotation');
    portal2AnimationEl.setAttribute('dur', '13000');
    portal2AnimationEl.setAttribute('to', '0 0 360');
    portal2AnimationEl.setAttribute('easing', 'linear');
    portal2AnimationEl.setAttribute('repeat', 'indefinite');
    portal2El.appendChild(portal2AnimationEl);

    var sceneEl = document.querySelector('a-scene');
    sceneEl.appendChild(portal1El);
    sceneEl.appendChild(portal2El);
}

async function despawnPortal() {
    await flashPortal();

    var sceneEl = document.querySelector('a-scene');
    var portal1El = document.querySelector('#portalcircle1');
    var portal2El = document.querySelector('#portalcircle2');

    sceneEl.removeChild(portal1El);
    sceneEl.removeChild(portal2El);
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
        console.log('Invalid JSON: ', message.data);
        return;
    }
    
    if(json.command === 'engage') {
        console.log(`Received command: Engage to ${json.location}`);
        spawnPortal(json.location);
    } else if(json.command === 'disengage') {
        console.log(`Received command: Disengage`);
        despawnPortal();
    } else if(json.command === 'playsound') {
        console.log(`Received command: Play sound ${json.sound}`);
        sounds.playSound(json.sound);
    }
}

function recoverFrom(baseUrl) {
    var portalEl = document.createElement('a-circle');
    portalEl.setAttribute('id', 'iris');
    portalEl.setAttribute('color', '#222222');
    portalEl.setAttribute('radius', '2.6');
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

    loadSounds();

    AFRAME.registerComponent('portal', {
        schema: {},
        init: function(){
            this.el.addEventListener('click', () => doTeleport());
        }
    });

    openConnection(baseurl);
}

main();
