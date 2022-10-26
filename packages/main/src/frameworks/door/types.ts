/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Actor, ScaledTransform } from "@willneedit/mixed-reality-extension-sdk";

export interface DoorPart {
	prefabid: string;                   // Kit ID
	lockedprefabid?: string;            // Kid ID when door is locked - must be leaf node if present
	closed: Partial<ScaledTransform>;   // Local transform when closed
	open?: Partial<ScaledTransform>;    // Local transform when open. Default: Doesn't move in relation to parent
	opendelay?: number;                 // Time index when to start opening move, default = 0
	openduration?: number;              // Duration to transition from closed to open
	closedelay?: number;                // Time index when to start closing move, default = 0
	closeduration?: number;             // Duration to transition from open to closed
	isHandle?: boolean;                 // True if item is the usable door handle
	parts?: DoorPart[];                 // Subparts of the door

	actor?: Actor;
}

export interface DoorStructure {
	opensound?: string;                 // URL of opening sound
	closesound?: string;                // URL of closing sound
	lockedsound?: string;               // URL of the sound when someone rattles the handle
	opentime: number;                   // Seconds the door remains open
	parts: DoorPart[];
}
