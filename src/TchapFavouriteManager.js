/*
Copyright 2021 Léo Mora <l.mora@outlook.fr>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import MatrixClientPeg from "./MatrixClientPeg";

/**
 * Tchap Favourite Manager.
 */
class TchapFavouriteManager {

    static addFavourite(event) {
        if (event && TchapFavouriteManager.isEventFavourite(event)) return;
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        const roomAccountData = room.getAccountData("m.tagged_events");
        let oldFavEvents = {};
        let otherTags = {};

        if (roomAccountData) {
            otherTags = roomAccountData.event.content.tags;
            oldFavEvents = roomAccountData.event.content.tags["m.favourite"];
            delete otherTags["m.favourite"];
        }

        const taggedEvents = {
            "tags" : {
                "m.favourite": {
                    [event.getId()]: {
                        "origin_server_ts": event.getTs(),
                        "tagged_at": Date.now()
                    },
                    ...oldFavEvents,
                },
                ...otherTags,
            }
        };

        MatrixClientPeg.get().setRoomAccountData(room.roomId, "m.tagged_events", taggedEvents);
    }

    static removeFavorite(event) {
        if (event && !TchapFavouriteManager.isEventFavourite(event)) return;
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        const roomAccountData = room.getAccountData("m.tagged_events");
        const eventId = event.getId();
        let favouriteEvents = {};
        let otherTags = {};

        if (roomAccountData) {
            otherTags = roomAccountData.event.content.tags;
            favouriteEvents = roomAccountData.event.content.tags["m.favourite"];
            delete otherTags["m.favourite"];
        }

        delete favouriteEvents[eventId];

        const taggedEvents = {
            "tags" : {
                "m.favourite": favouriteEvents,
                ...otherTags,
            }
        };

        MatrixClientPeg.get().setRoomAccountData(room.roomId, "m.tagged_events", taggedEvents);
    }

    static isEventFavourite(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        const taggedEvents = room.getAccountData("m.tagged_events");
        if (taggedEvents) {
            const favouriteEvent = taggedEvents.event.content.tags['m.favourite'];
            if (Object.keys(favouriteEvent).includes(event.getId())) {
                return true;
            }
        }
        return false;
    }
}

module.exports = TchapFavouriteManager;
