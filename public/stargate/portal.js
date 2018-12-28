function doTeleport() {
    var el = document.querySelector('#portalcircle');

    // window.Alt.HtmlView.FollowAltspaceLink('altspace://account.altvr.com/api/spaces/campfire-lobby');
}

function main() {
    var el = document.querySelector('#portalcircle');

    AFRAME.registerComponent('portal', {
        schema: {},
        init: function(){
            this.el.addEventListener('click', () => doTeleport());
        }
    });

}

main();
