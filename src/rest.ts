/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';

function wrapAsync(fn: (req: RS.Request, res: RS.Response, next: RS.Next) => Promise<void>) {
    return (req: RS.Request, res: RS.Response, next: RS.Next) => {
        return fn(req, res, next).catch((err: any) => {
            res.send(500, err);
            next();
        });
    };
}

async function locateSG(req: RS.Request, res: RS.Response, next: RS.Next) {
    res.send({
        sgaddress: req.params.sgaddress as string,
        location: 'unknown'
    });
    next();
}

export function initReSTServer(port: number): RS.Server {
    const restServer = RS.createServer();
    restServer.get('/rest/locate/:sgaddress', wrapAsync(locateSG));
    restServer.listen(port, () => {
        // console.log("%s listening at %s", restServer.name, restServer.url);
    });
    return restServer;
}
