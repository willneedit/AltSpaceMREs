/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { SGDBLike, SGDBLocationEntry } from "./database";

import pgescape from 'pg-escape';
import { Client as PG, QueryResult } from 'pg';

export class SGDBpg implements SGDBLike {
	private dbConn: PG = null;

	public async init() {

		const result = new Promise<void>((res,rej) => {
			if (process.env.DATABASE_URL !== '') {
				// Running in Heroku, using provided information
				console.debug('Starting with provided database parameters');
				this.dbConn = new PG({
					connectionString: process.env.DATABASE_URL,
					ssl: { rejectUnauthorized: false }, // New with pg8: Trouble with Heroku's self-signed cert
				});
			} else {
				console.debug('No database parameters passed, using local config');
				// Running locally, for testing purposes
				// DATABASE MOVED, to ease use of Heroku's pg:push and pg:pull
				// Used with:
				//  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgresql \
				//  heroku pg:pull DATABASE_URL stargate -a willneedit-mre
				// Use 'CREATE DATABASE stargate;' to initialize
				this.dbConn = new PG({
					host: 'localhost',
					database: 'stargate',
					user: 'postgres',
					password: 'postgresql'
				});
			}

			this.dbConn.connect()
			.then(() => {
				console.debug('Creating table known_locations...');
				this.dbConn.query('CREATE TABLE IF NOT EXISTS known_locations (' +
					'lid BIGINT NOT NULL,' +
					'gid INTEGER NOT NULL,' +
					'location VARCHAR NOT NULL,' +
					'lastseen TIMESTAMP NOT NULL,' +
					'PRIMARY KEY (lid,gid) )'
				).then((qres) => {
					console.debug('Database creation finished');
					res();
				});

			}).catch(err => {
				console.error(`DATABASE CONNECTION FAILED, err=${err}`);
				rej(err);
			});
		});

		return result;

	}

	/**
	 * Retrieve the location database entry for the given location
	 * @param lid numerical location ID or in-galaxy location
	 * @param gid Galaxy ID
	 */
	public async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
		const str = this.getWhereClause(lid, gid);

		return this.dbConn.query('SELECT lid, gid, location, lastseen FROM known_locations' + str
		).then((res: QueryResult) => {
			if (res.rowCount === 0) return Promise.reject('Empty result');

			res.rows[0].lid = +res.rows[0].lid;
			res.rows[0].gid = +res.rows[0].gid;

			return Promise.resolve(res.rows[0]);
		}
		);
	}

	public async updateTimestamp(lid: number | string, gid: number): Promise<void> {
		const str = this.getWhereClause(lid, gid);

		this.dbConn.query("UPDATE known_locations SET lastseen = now()" + str);
		return Promise.resolve();
	}

	private getWhereClause(lid: string | number, gid: number) {
		if (typeof lid === 'number') {
			return pgescape(' WHERE (lid=%L AND gid=%L)', lid.toString(), gid.toString());
		} else {
			return pgescape(' WHERE (location=%L AND gid=%L)', lid, gid.toString());
		}
	}

	public async registerLocation(lid: number, gid: number, location: string) {
		const str = pgescape('INSERT INTO known_locations (lid,gid,location,lastseen) VALUES (%L, %L, %L, %L)',
			lid.toString(),
			gid.toString(),
			location,
			"now()");

		return this.dbConn.query(str);
	}

	public deleteLocation(gid: number, location: string) {
		return this.dbConn.query(pgescape('DELETE FROM known_locations WHERE (gid=%L AND location=%L)',
			gid.toString(),
			location));
	}

}
