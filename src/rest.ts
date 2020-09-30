/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';
import { SGDB, SGDBLocationEntry } from './stargate/sg_database';

function wrapAsync(fn: (req: RS.Request, res: RS.Response, next: RS.Next) => Promise<void>) {
    return (req: RS.Request, res: RS.Response, next: RS.Next) => {
        return fn(req, res, next).catch((err: any) => {
            res.send(500, err);
            next();
        });
    };
}

function locateSGperID(req: RS.Request, res: RS.Response, next: RS.Next) {
    SGDB.getLocationDataId(req.params.sgaddress as string).then((le: SGDBLocationEntry) => {
        res.send(le);
        next();
    }).catch((err: any) => {
        res.send(404, err);
        next();
    });
}

function locateSGperLoc(req: RS.Request, res: RS.Response, next: RS.Next) {
    SGDB.getLocationDataLoc(req.params.sglocation, req.params.galaxy)
    .then((le: SGDBLocationEntry) => {
        res.send(le);
        next();
    }).catch((err: any) => {
        res.send(404, err);
        next();
    });
}

export function initReSTServer(port: number): RS.Server {
    const restServer = RS.createServer();
    restServer.get('/rest/locate_id/:sgaddress', locateSGperID);
    restServer.get('/rest/locate_loc/:galaxy/:sglocation', locateSGperLoc);
    restServer.listen(port, () => {
        // console.log("%s listening at %s", restServer.name, restServer.url);
    });
    return restServer;
}
