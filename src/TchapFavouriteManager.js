import MatrixClientPeg from "./MatrixClientPeg";
import { MatrixEvent } from 'matrix-js-sdk';


/**
 * Tchap Favourite Manager.
 */
class TchapFavouriteManager {

    static addFavourite(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        const roomAccountData = room.getAccountData("m.tagged_events");
        let oldFavEvents = {};
        if (roomAccountData) {
            oldFavEvents = roomAccountData.event.content.tags["m.favourite"];
        }

        const taggedEvents = {
            "tags" : {
                "m.favourite": {
                    ...oldFavEvents,
                    [event.getId()]: {
                        "origin_server_ts": event.getTs(),
                        "tagged_at": Date.now()
                    }
                }
            }
        };

        MatrixClientPeg.get().setRoomAccountData(room.roomId, "m.tagged_events", taggedEvents);
    }

    static removeFavorite(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        const roomAccountData = room.getAccountData("m.tagged_events");
        const eventId = event.getId();
        let favouriteEvents = {};

        if (roomAccountData) {
            favouriteEvents = roomAccountData.event.content.tags["m.favourite"];
        }

        delete favouriteEvents[eventId];

        const taggedEvents = {
            "tags" : {
                "m.favourite": {}
            }
        };

        MatrixClientPeg.get().setRoomAccountData(room.roomId, "m.tagged_events", taggedEvents);
    }

    static getFavorite(room) {
        return room.getAccountData("m.tagged_events");
    }

    static isEventFavourite(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        let taggedEvents = room.getAccountData("m.tagged_events");
        if (taggedEvents) {
            let favouriteEvent = taggedEvents.event.content.tags['m.favourite'];
            if (Object.keys(favouriteEvent).includes(event.getId())) {
                return true;
            }
        }
        return false;
    }
}

module.exports = TchapFavouriteManager;
