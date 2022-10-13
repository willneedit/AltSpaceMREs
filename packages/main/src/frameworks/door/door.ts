/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { DoorPart, DoorStructure } from "./types";

import got from "got";
import { ContextLike } from "../context/types";

import {
	Actor,
	ActorLike,
	AnimationEaseCurves,
	ButtonBehavior,
	DegreesToRadians,
	MediaInstance,
	Quaternion,
	User,
	Guid,
} from "@microsoft/mixed-reality-extension-sdk";

import { delay, initSound, restartSound } from "../../helpers";

export default class BasicDoor {
	private static cache: { [url: string]: { time: number; struct: Promise<DoorStructure> } } = { };

	private context: ContextLike = null;
	private doorstate: DoorStructure = null;

	private _locked = false;
	private _open = false;

	public get locked() { return this._locked; }
	public set locked(toLocked: boolean) { this.updateDoorState(this._open, toLocked); }

	public get open() { return this._open; }
	public set open(toOpen: boolean) { this.updateDoorState(toOpen, this._locked); }

	private doorRoot: Actor = null;

	private openSoundFX: MediaInstance = null;
	private closeSoundFX: MediaInstance = null;
	private lockedSoundFX: MediaInstance = null;

	private translateRotations(dp: DoorPart) {
		if (dp.closed && dp.closed.rotation) {
			dp.closed.rotation = Quaternion.RotationYawPitchRoll(
				dp.closed.rotation.y * DegreesToRadians,
				dp.closed.rotation.x * DegreesToRadians,
				dp.closed.rotation.z * DegreesToRadians
			);
		}

		if (dp.open && dp.open.rotation) {
			dp.open.rotation = Quaternion.RotationYawPitchRoll(
				dp.open.rotation.y * DegreesToRadians,
				dp.open.rotation.x * DegreesToRadians,
				dp.open.rotation.z * DegreesToRadians
			);
		}

		if (dp.parts) {
			dp.parts.forEach((dp2: DoorPart) => { this.translateRotations(dp2); });
		} else dp.parts = [ ];
	}

	private translateDSRotations(ds: DoorStructure) {
		ds.parts.forEach((dp: DoorPart) => { this.translateRotations(dp); });
	}

	private async loadDoorStructure(source: string | DoorStructure): Promise<DoorStructure> {

		const currentTime = new Date().getTime() / 1000;

		// Return a structure as-is
		if (typeof source !== 'string') {
			const ds: DoorStructure = source;
			this.translateDSRotations(ds);
			return ds;
		}

		if (BasicDoor.cache[source] && BasicDoor.cache[source].time < currentTime) {
			BasicDoor.cache[source] = undefined;
		}

		// If we already have something cached, or waiting for the cache, return the Promise
		if (BasicDoor.cache[source]) return BasicDoor.cache[source].struct;

		BasicDoor.cache[source] = { time: currentTime + 10, struct: null };

		// Else create a new entry and wait for it to be filled
		BasicDoor.cache[source].struct = new Promise<DoorStructure>((resolve, reject) => {
			got(source, {responseType: 'json', resolveBodyOnly: true})
			.then((response) => {
				const ds = response as DoorStructure;
				this.translateDSRotations(ds);
				resolve(ds);
			})
			.catch((err) => { reject(err); });
		});

		return BasicDoor.cache[source].struct;
	}

	public started(ctx: ContextLike, source: string | DoorStructure) {
		this.context = ctx;
		this.loadDoorStructure(source).then((ds: DoorStructure) => { this.initDoor(ds); });
	}

	public stopped = async () => {
	}

	private updateDoorPart(pid: Guid, dp: DoorPart, updateopenstate: boolean, updatelockstate: boolean) {
		if (!dp.actor || updatelockstate) {
			const actorDef: Partial<ActorLike> = {
				parentId: pid
			};

			actorDef.transform = this._open && dp.open
				? { local: dp.open }
				: { local: dp.closed };

			if (dp.actor) dp.actor.destroy();

			dp.actor = this.context.CreateFromLibrary({
				resourceId: this._locked && dp.lockedprefabid ? dp.lockedprefabid : dp.prefabid,
				actor: actorDef
			});

			if (dp.isHandle) {
				dp.actor.setBehavior(ButtonBehavior).onClick((user: User) => { this.handlePressed(user); } );
			}
		} else if (updateopenstate) {
			if (this._open && dp.open) {
				setTimeout(() => {
					dp.actor.animateTo({
						transform: { local: dp.open }
					}, dp.openduration, AnimationEaseCurves.EaseInOutSine);
				}, (dp.opendelay || 0) * 1000);
			} else {
				setTimeout(() => {
					dp.actor.animateTo({
						transform: { local: dp.closed }
					}, dp.closeduration, AnimationEaseCurves.EaseInOutSine);
				}, (dp.closedelay || 0) * 1000);
			}
		}

		dp.parts.forEach((dp2: DoorPart) => {
			this.updateDoorPart(dp.actor.id, dp2, updateopenstate, updatelockstate);
		});
	}

	private initDoor(ds: DoorStructure) {
		this.doorRoot = this.context.CreateEmpty();

		if (ds.opensound) this.openSoundFX = initSound(this.context.assets, this.doorRoot, ds.opensound);
		if (ds.closesound) this.closeSoundFX = initSound(this.context.assets, this.doorRoot, ds.closesound);
		if (ds.lockedsound) this.lockedSoundFX = initSound(this.context.assets, this.doorRoot, ds.closesound);

		// Deep clone the door structure to avoid backscatter into the cache
		this.doorstate = JSON.parse(JSON.stringify(ds));
		this.doorstate.parts.forEach((dp: DoorPart) => {
			this.updateDoorPart(this.doorRoot.id, dp, false, false);
		});
	}

	private updateDoorState(toOpen: boolean, toLocked: boolean) {
		let updatelockstate = false;
		let updateopenstate = false;

		if (toOpen !== this.open) updateopenstate = true;
		if (toLocked !== this.locked) updatelockstate = true;

		if (!updateopenstate && !updatelockstate) return;

		this._locked = toLocked;

		if (this.locked && updateopenstate) {
			restartSound(this.lockedSoundFX);
			updateopenstate = false;
		}

		if (updateopenstate) {
			this._open = toOpen;
			restartSound(toOpen ? this.openSoundFX : this.closeSoundFX);
		}

		this.doorstate.parts.forEach((dp: DoorPart) => {
			this.updateDoorPart(this.doorRoot.id, dp, updateopenstate, updatelockstate);
		});

		if (this._open && this.doorstate.opentime) {
			delay(this.doorstate.opentime * 1000).then(() => { this.updateDoorState(false, toLocked); });
		}
	}

	private handlePressed(user: User) {
		this.open = !this.open;
	}
}
