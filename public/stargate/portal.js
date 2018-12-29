function doTeleport() {
    var el = document.querySelector('#portalcircle');

    // window.Alt.HtmlView.FollowAltspaceLink('altspace://account.altvr.com/api/spaces/campfire-lobby');
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
    } else if(json.command === 'disengage') {
        console.log(`Received command: Disengage`);
    }
}

function main() {
    var el = document.querySelector('#portalcircle');
    var baseurl = document.origin;
    baseurl = baseurl.replace('http://', 'ws://');
    baseurl = baseurl.replace('https://', 'ws://');

    var controlSocket = new WebSocket(baseurl+'/control');
    controlSocket.onopen = () => sendInitMessage(controlSocket);
    controlSocket.onmessage = (message) => receiveCommand(message);

    AFRAME.registerComponent('portal', {
        schema: {},
        init: function(){
            this.el.addEventListener('click', () => doTeleport());
        }
    });

}

main();
