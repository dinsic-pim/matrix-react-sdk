/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import MultiInviter from './utils/MultiInviter';
import Modal from './Modal';
import { getAddressType } from './UserAddress';
import createRoom from './createRoom';
import sdk from './';
import dis from './dispatcher';
import DMRoomMap from './utils/DMRoomMap';
import { _t } from './languageHandler';

export function inviteToRoom(roomId, addr) {
    const addrType = getAddressType(addr);

    if (addrType == 'email') {
        return MatrixClientPeg.get().inviteByEmail(roomId, addr);
    } else if (addrType == 'mx-user-id') {
        return MatrixClientPeg.get().invite(roomId, addr);
    } else {
        throw new Error('Unsupported address');
    }
}

/**
 * Invites multiple addresses to a room
 * Simpler interface to utils/MultiInviter but with
 * no option to cancel.
 *
 * @param {string} roomId The ID of the room to invite to
 * @param {string[]} addrs Array of strings of addresses to invite. May be matrix IDs or 3pids.
 * @returns {Promise} Promise
 */
export function inviteMultipleToRoom(roomId, addrs) {
    const inviter = new MultiInviter(roomId);
    return inviter.invite(addrs);
}

export function showStartChatInviteDialog() {
    const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
    Modal.createTrackedDialog('Start a chat', '', AddressPickerDialog, {
        title: _t('Start a chat'),
        description: _t("Who would you like to communicate with?"),
        placeholder: _t("Name"),
        validAddressTypes: ['mx-user-id', 'email'],
        button: _t("Start Chat"),
        invitationType: 'direct',
        onFinished: _onStartChatFinished,
    });
}

export function showRoomInviteDialog(roomId) {
    const AddressPickerDialog = sdk.getComponent("dialogs.AddressPickerDialog");
    Modal.createTrackedDialog('Chat Invite', '', AddressPickerDialog, {
        title: _t('Invite new room members'),
        description: _t('Who would you like to add to this room?'),
        button: _t('Send Invites'),
        placeholder: _t("Name"),
        invitationType: 'room',
        onFinished: (shouldInvite, addrs) => {
            _onRoomInviteFinished(roomId, shouldInvite, addrs);
        },
    });
}

function viewRoomDispatcher(roomId) {
    dis.dispatch({
        action: 'view_room',
        room_id: roomId,
    });
}

function errorHandler(action, err) {
    dis.dispatch({
        action: action,
        err: err,
    });
    const msg = err.message ? err.message : JSON.stringify(err);
    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
    Modal.createTrackedDialog('Failed to join room', '', ErrorDialog, {
        title: _t("Failed to join room"),
        description: msg,
    });
}

function selectRoom(addrTexts) {
    // Gets all rooms which the current user is involved in
    let rooms = MatrixClientPeg.get().getRooms();
    let selectedRoom = {
        room : null,
        status: null,
        date: null
    };

    rooms.forEach(room => {
        let members = room.currentState.members;

        // Get my own "member" object
        let me = members[MatrixClientPeg.get().credentials.userId];
        if (addrTexts[0] in members && Object.keys(members).length <= 2 && me !== null && typeof me !== "undefined") {
            // Get the "member" object of the user that I want to contact
            let him = members[Object.keys(members)[0]].userId === me.userId ? members[Object.keys(members)[1]] : members[Object.keys(members)[0]];
            let roomCreateEvent = room.currentState.getStateEvents("m.room.create");
            let roomCreateEventDate = roomCreateEvent[0] ? roomCreateEvent[0].event.origin_server_ts : 0;

            // Colliding all the "me.membership" and "him.membership" possibilities

            // "join" <=> "join" state
            if (me.membership === "join" && him.membership === "join") {
                if (selectedRoom.date === null || roomCreateEventDate < selectedRoom.date) {
                    selectedRoom = {room : room, status : "join-join", date : roomCreateEventDate};
                }

            // "invite" <=> "join" state
            // I have received an invitation from the other member
            } else if (me.membership === "invite" && him.membership === "join") {
                if (selectedRoom.date === null || roomCreateEventDate < selectedRoom.date) {
                    selectedRoom = {room: room, status: "invite-join", date: roomCreateEventDate};
                }
            // "join" <=> "invite" state
            // The other member already have an invitation
            } else if (me.membership === "join" && him.membership === "invite") {
                if (selectedRoom.date === null || roomCreateEventDate < selectedRoom.date) {
                    selectedRoom = {room : room, status : "join-invite", date : roomCreateEventDate};
                }

            // "join" <=> "leave" state
            // The other member have left/reject my invitation
            } else if (me.membership === "join" && him.membership === "leave") {
                if (selectedRoom.date === null || roomCreateEventDate < selectedRoom.date) {
                    selectedRoom = {room : room, status : "join-leave", date : roomCreateEventDate};
                }
            } else {
                selectedRoom = null;
            }
        }
    });

    return selectedRoom;
}


function _onStartChatFinished(shouldInvite, addrs) {
    if (!shouldInvite) return;
    const addrTexts = addrs.map((addr) => addr.address);

    if (addrTexts.length === 1) {
        let selectedRoom = selectRoom(addrTexts);
        let roomStatus = selectedRoom ? selectedRoom.status : null;

        switch (roomStatus) {
            case "join-join":
                // Redirect to the existing room
                viewRoomDispatcher(selectedRoom.room.roomId);
                break;

            case "invite-join":
                // Join room then redirect to this room
                MatrixClientPeg.get().joinRoom(selectedRoom.room.roomId).done(() => {
                    viewRoomDispatcher(selectedRoom.room.roomId);
                }, err => errorHandler('join_room_error', err));
                break;

            case "join-invite":
                // Redirect to the existing room
                viewRoomDispatcher(selectedRoom.room.roomId);
                break;

            case "join-leave":
                // Send an invitation then redirect to the existing room
                inviteToRoom(selectedRoom.room.roomId, addrTexts[0]);
                viewRoomDispatcher(selectedRoom.room.roomId);
                break;

            default:
                // Create a new room
                createRoom({dmUserId: addrTexts[0]}).catch((err) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
                        title: _t("Failed to invite user"),
                        description: ((err && err.message) ? err.message : _t("Operation failed")),
                    });
                });
                break;
        }
    } else {
        // Start multi user chat
        let room;
        createRoom().then((roomId) => {
            room = MatrixClientPeg.get().getRoom(roomId);
            return inviteMultipleToRoom(roomId, addrTexts);
        }).then((addrs) => {
            return _showAnyInviteErrors(addrs, room);
        }).catch((err) => {
            console.error(err.stack);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
                title: _t("Failed to invite"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    }
}

function _onRoomInviteFinished(roomId, shouldInvite, addrs) {
    if (!shouldInvite) return;

    const addrTexts = addrs.map((addr) => addr.address);

    // Invite new users to a room
    inviteMultipleToRoom(roomId, addrTexts).then((addrs) => {
        const room = MatrixClientPeg.get().getRoom(roomId);
        return _showAnyInviteErrors(addrs, room);
    }).catch((err) => {
        console.error(err.stack);
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite', '', ErrorDialog, {
            title: _t("Failed to invite"),
            description: ((err && err.message) ? err.message : _t("Operation failed")),
        });
    });
}

function _isDmChat(addrTexts) {
    if (addrTexts.length === 1 && getAddressType(addrTexts[0]) === 'mx-user-id') {
        return true;
    } else {
        return false;
    }
}

function _showAnyInviteErrors(addrs, room) {
    // Show user any errors
    const errorList = [];
    for (const addr of Object.keys(addrs)) {
        if (addrs[addr] === "error") {
            errorList.push(addr);
        }
    }

    if (errorList.length > 0) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Failed to invite the following users to the room', '', ErrorDialog, {
            title: _t("Failed to invite the following users to the %(roomName)s room:", {roomName: room.name}),
            description: errorList.join(", "),
        });
    }
    return addrs;
}

function _getDirectMessageRooms(addr) {
    const dmRoomMap = new DMRoomMap(MatrixClientPeg.get());
    const dmRooms = dmRoomMap.getDMRoomsForUserId(addr);
    const rooms = [];
    dmRooms.forEach((dmRoom) => {
        const room = MatrixClientPeg.get().getRoom(dmRoom);
        if (room) {
            const me = room.getMember(MatrixClientPeg.get().credentials.userId);
            if (me.membership == 'join') {
                rooms.push(room);
            }
        }
    });
    return rooms;
}

