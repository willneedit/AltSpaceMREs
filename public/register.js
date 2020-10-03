var _currentsgid;

async function sendInitMessage(socket)
{
    var user = await altspace.getUser();
    var space = await altspace.getSpace();

    socket.send(JSON.stringify({ name: 'sg_register_init',
        url: document.URL,
        location: space.sid,
        userId: user.userId,
        userName: user.displayName
    }));
}

function processCommand(json)
{
    console.debug(json);

    if (json.response === 'init_response') {
        if (!json.isAdmin) removeCustSgidEntry();
        return;
    }

    fillObjectList(json.objlist);

    fillWorldData(json.sgid, json.location, json.status);

    _currentsgid = json.sgid;
}


async function sg_register()
{
    var user = await altspace.getUser();
    var space = await altspace.getSpace();

    _controlSocket.send(JSON.stringify({ name: 'sg_register',
        url: document.URL,
        sgid: _currentsgid,
        custom_sgid: getCustSgid(),
        location: space.sid,
        userId: user.userId,
        userName: user.displayName
    }));
}

function main()
{
    sock_init();
}
