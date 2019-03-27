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
        validAddressTypes: ['mx-user-id'],
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

function selectRoom(invitedUserId) {
    const matrixClient = MatrixClientPeg.get();
    const dmRoomMap = new DMRoomMap(matrixClient);
    const roomList = dmRoomMap.getDMRoomsForUserId(invitedUserId);

    let selectedRoom = {
        room : null,
        status: null,
        date: null,
        weight: 0
    };

    roomList.forEach(roomId => {
        const room = matrixClient.getRoom(roomId);

        if (room) {
            const members = room.currentState.members;
            const him = members[invitedUserId];
            const myMembership = room.getMyMembership();
            const hisMembership = him.membership;

            const roomCreateEvent = room.currentState.getStateEvents("m.room.create");
            const roomCreateEventDate = roomCreateEvent[0] ? roomCreateEvent[0].event.origin_server_ts : 0;

            // Colliding all the "myMembership" and "hisMembership" possibilities.

            // "join" <=> "join" state.
            if (myMembership === "join" && hisMembership === "join") {
                if (selectedRoom === null || selectedRoom.weight < 4 ||
                    (selectedRoom.weight === 4 && roomCreateEventDate < selectedRoom.date)) {
                    selectedRoom = { room: room, status: "join-join", date: roomCreateEventDate, weight: 4 };
                }

            // "invite" <=> "join" state.
            // I have received an invitation from the other member.
            } else if (myMembership === "invite" && hisMembership === "join") {
                if (selectedRoom === null || selectedRoom.weight < 3 ||
                    (selectedRoom.weight === 3 && roomCreateEventDate < selectedRoom.date)) {
                    selectedRoom = { room: room, status: "invite-join", date: roomCreateEventDate, weight: 3 };
                }

            // "join" <=> "invite" state.
            // The other member already have an invitation.
            } else if (myMembership === "join" && hisMembership === "invite") {
                if (selectedRoom === null || selectedRoom.weight < 2 ||
                    (selectedRoom.weight === 2 && roomCreateEventDate < selectedRoom.date)) {
                    selectedRoom = { room: room, status: "join-invite", date: roomCreateEventDate, weight: 2 };
                }

            // "join" <=> "leave" state.
            // The other member have left/reject my invitation.
            } else if (myMembership === "join" && hisMembership === "leave") {
                if (selectedRoom === null || selectedRoom.weight < 1 ||
                    (selectedRoom.weight === 1 && roomCreateEventDate < selectedRoom.date)) {
                    selectedRoom = { room: room, status: "join-leave", date: roomCreateEventDate, weight: 1 };
                }
            } else {
                selectedRoom = {
                    room : null,
                    status: null,
                    date: null,
                    weight: 0
                };
            }
        }
    });

    selectedRoom = selectedRoom.room !== null && selectedRoom.status !== null && selectedRoom.date !== null ? selectedRoom : null;
    return selectedRoom;
}


function directRoomManager(addrs) {
    const matrixClient = MatrixClientPeg.get();
    const addrTexts = addrs.map((addr) => addr.address)[0];
    const addrType = addrs.map((addr) => addr.addressType)[0];
    const addrKnown = addrs.map((addr) => addr.isKnown)[0];
    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

    if (addrKnown === true) {
        matrixClient.lookupThreePid(addrType, addrTexts).then(res => {
            const invitedUserId = Object.entries(res).length === 0 ? addrTexts : res.mxid;
            const selectedRoom = selectRoom(invitedUserId);
            const roomStatus = selectedRoom ? selectedRoom.status : null;

            switch (roomStatus) {
                case "join-join":
                    // Redirect to the existing room.
                    viewRoomDispatcher(selectedRoom.room.roomId);
                    break;

                case "invite-join":
                    // Join room then redirect to this room.
                    matrixClient.joinRoom(selectedRoom.room.roomId).done(() => {
                        viewRoomDispatcher(selectedRoom.room.roomId);
                    }, err => errorHandler('join_room_error', err));
                    break;

                case "join-invite":
                    // Redirect to the existing room.
                    viewRoomDispatcher(selectedRoom.room.roomId);
                    break;

                case "join-leave":
                    // Send an invitation then redirect to the existing room.
                    inviteToRoom(selectedRoom.room.roomId, addrTexts);
                    viewRoomDispatcher(selectedRoom.room.roomId);
                    break;

                default:
                    // Create a new room.
                    createRoom({dmUserId: addrTexts}).catch((err) => {
                        Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
                            title: _t("Failed to invite user"),
                            description: ((err && err.message) ? err.message : _t("Operation failed")),
                        });
                    });
                    break;
            }

        }).catch(err => {
            Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
                title: _t("Failed to invite user"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });

    } else if (addrKnown === false && addrType === "email") {
        // Case where a non-Tchap user is invited by email
        const dmRoomMap = new DMRoomMap(matrixClient);
        const dmRoomList = dmRoomMap.getDMRoomsForUserId(addrTexts);
        const InformationDialog = sdk.getComponent("dialogs.InformationDialog");
        let existingRoom = false;

        dmRoomList.forEach(roomId => {
            let room = matrixClient.getRoom(roomId);
            if (room && room.getMyMembership() === "join") {
                existingRoom = true;
            }
        });

        if (existingRoom) {
            Modal.createTrackedDialog('New user by email : Invitation already sent', '', InformationDialog, {
                title: _t("Start a chat"),
                description: _t("You have already sent an invitation to %(email)s.", {email: addrTexts} ),
            });
        } else {
            Modal.createTrackedDialog('New user by email : Invitation sent', '', InformationDialog, {
                title: _t("Start a chat"),
                description: _t("An invitation has been sent to %(email)s. You will receive a notification when your guest joins the Tchap community.", {email: addrTexts} ),
            });
            createRoom({dmUserId: addrTexts, andView: false}).catch((err) => {
                Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
                    title: _t("Failed to invite user"),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            });
        }
    } else {
        // Error case (no email nor mxid).
        Modal.createTrackedDialog('Failed to invite user', '', ErrorDialog, {
            title: _t("Failed to invite user"),
            description: _t("Operation failed"),
        });
    }
}


function _onStartChatFinished(shouldInvite, addrs) {
    if (!shouldInvite) return;
    const addrTexts = addrs.map((addr) => addr.address);

    if (addrTexts.length === 1) {
        // Manage direct chat.
        directRoomManager(addrs);
    } else {
        // Start multi user chat.
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
