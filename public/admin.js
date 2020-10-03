var _socket;

async function sendInitMessage(socket)
{
    socket.send(JSON.stringify({ name: 'sg_admin',
        command: 'getlist',
        url: document.URL,
    }));
    _socket = socket;
}

function sga_delete(id_value)
{
    _socket.send(JSON.stringify({ name: 'sg_admin',
        command: 'delete',
        id: id_value,
        url: document.URL,
    }));
}

function sga_visit(location)
{
    if (!window.altspace || !window.altspace.inClient)
        alert('You can do that only from inside Altspace.');
    else
        window.Alt.HtmlView.FollowAltspaceLink('altspace://account.altvr.com/api/spaces/' + location);
}

function mkDeleteButton(id)
{
    return `<button onclick="sga_delete('${id}')">Delete</button>`
}

function mkVisitButton(id)
{
    return `<button onclick="sga_visit('${id}')">Visit</button>`
}

function processCommand(json)
{
    console.debug(json);
    var contents = '<table>';

    for(var line of json.lines) {
        var vBtnTag = mkVisitButton(line.location);
        var dBtnTag = mkDeleteButton(line.id);

        contents = contents
        + '<tr>'
        + `<td>${vBtnTag}</td><td>${line.id}</td><td>${line.location}</td>`
        + (json.isAdmin ? `<td>${dBtnTag}</td>` : '')
        + '</tr>'
    }

    contents = contents + '</table>';

    populate(contents);
}

function main()
{
    sock_init();
}
