/*
Copyright 2019 New Vector Ltd

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

import React from "react";
import dis from "../../../dispatcher";
import MatrixClientPeg from "../../../MatrixClientPeg";
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import AccessibleButton from '../elements/AccessibleButton';
import RoomAvatar from '../avatars/RoomAvatar';
import classNames from 'classnames';
import sdk from "../../../index";
import Analytics from "../../../Analytics";
import * as RoomNotifs from '../../../RoomNotifs';
import * as FormattingUtils from "../../../utils/FormattingUtils";
import DMRoomMap from "../../../utils/DMRoomMap";
import {_t} from "../../../languageHandler";

const MAX_ROOMS = 20;

export default class RoomBreadcrumbs extends React.Component {
    constructor(props) {
        super(props);
        this.state = {rooms: []};

        this.onAction = this.onAction.bind(this);
        this._dispatcherRef = null;
    }

    componentWillMount() {
        this._dispatcherRef = dis.register(this.onAction);

        let storedRooms = SettingsStore.getValue("breadcrumb_rooms");
        if (!storedRooms || !storedRooms.length) {
            // Fallback to the rooms stored in localstorage for those who would have had this.
            // TODO: Remove this after a bit - the feature was only on develop, so a few weeks should be plenty time.
            const roomStr = localStorage.getItem("mx_breadcrumb_rooms");
            if (roomStr) {
                try {
                    storedRooms = JSON.parse(roomStr);
                } catch (e) {
                    console.error("Failed to parse breadcrumbs:", e);
                }
            }
        }
        this._loadRoomIds(storedRooms || []);

        this._settingWatchRef = SettingsStore.watchSetting("breadcrumb_rooms", null, this.onBreadcrumbsChanged);

        MatrixClientPeg.get().on("Room.myMembership", this.onMyMembership);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Event.decrypted", this.onEventDecrypted);
    }

    componentWillUnmount() {
        dis.unregister(this._dispatcherRef);

        SettingsStore.unwatchSetting(this._settingWatchRef);

        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("Room.myMembership", this.onMyMembership);
            client.removeListener("Room.receipt", this.onRoomReceipt);
            client.removeListener("Room.timeline", this.onRoomTimeline);
            client.removeListener("Event.decrypted", this.onEventDecrypted);
        }
    }

    componentDidUpdate() {
        const rooms = this.state.rooms.slice();

        if (rooms.length) {
            const roomModel = rooms[0];
            if (!roomModel.animated) {
                roomModel.animated = true;
                setTimeout(() => this.setState({rooms}), 0);
            }
        }
    }

    onAction(payload) {
        switch (payload.action) {
            case 'view_room':
                this._appendRoomId(payload.room_id);
                break;
        }
    }

    onMyMembership = (room, membership) => {
        if (membership === "leave" || membership === "ban") {
            const rooms = this.state.rooms.slice();
            const roomState = rooms.find((r) => r.room.roomId === room.roomId);
            if (roomState) {
                roomState.left = true;
                this.setState({rooms});
            }
        }
    };

    onRoomReceipt = (event, room) => {
        if (this.state.rooms.map(r => r.room.roomId).includes(room.roomId)) {
            this._calculateRoomBadges(room);
        }
    };

    onRoomTimeline = (event, room) => {
        if (this.state.rooms.map(r => r.room.roomId).includes(room.roomId)) {
            this._calculateRoomBadges(room);
        }
    };

    onEventDecrypted = (event) => {
        if (this.state.rooms.map(r => r.room.roomId).includes(event.getRoomId())) {
            this._calculateRoomBadges(MatrixClientPeg.get().getRoom(event.getRoomId()));
        }
    };

    onBreadcrumbsChanged = (settingName, roomId, level, valueAtLevel, value) => {
        if (!value) return;

        const currentState = this.state.rooms.map((r) => r.room.roomId);
        if (currentState.length === value.length) {
            let changed = false;
            for (let i = 0; i < currentState.length; i++) {
                if (currentState[i] !== value[i]) {
                    changed = true;
                    break;
                }
            }
            if (!changed) return;
        }

        this._loadRoomIds(value);
    };

    _loadRoomIds(roomIds) {
        if (!roomIds || roomIds.length <= 0) return; // Skip updates with no rooms

        // If we're here, the list changed.
        const rooms = roomIds.map((r) => MatrixClientPeg.get().getRoom(r)).filter((r) => r).map((r) => {
            const badges = this._calculateBadgesForRoom(r) || {};
            return {
                room: r,
                animated: false,
                ...badges,
            };
        });
        this.setState({
            rooms: rooms,
        });
    }

    _calculateBadgesForRoom(room) {
        if (!room) return null;

        // Reset the notification variables for simplicity
        const roomModel = {
            redBadge: false,
            formattedCount: "0",
            showCount: false,
        };

        const notifState = RoomNotifs.getRoomNotifsState(room.roomId);
        if (RoomNotifs.MENTION_BADGE_STATES.includes(notifState)) {
            const highlightNotifs = RoomNotifs.getUnreadNotificationCount(room, 'highlight');
            const unreadNotifs = RoomNotifs.getUnreadNotificationCount(room);

            const redBadge = highlightNotifs > 0;
            const greyBadge = redBadge || (unreadNotifs > 0 && RoomNotifs.BADGE_STATES.includes(notifState));

            if (redBadge || greyBadge) {
                const notifCount = redBadge ? highlightNotifs : unreadNotifs;
                const limitedCount = FormattingUtils.formatCount(notifCount);

                roomModel.redBadge = redBadge;
                roomModel.formattedCount = limitedCount;
                roomModel.showCount = true;
            }
        }

        return roomModel;
    }

    _calculateRoomBadges(room) {
        if (!room) return;

        const rooms = this.state.rooms.slice();
        const roomModel = rooms.find((r) => r.room.roomId === room.roomId);
        if (!roomModel) return; // No applicable room, so don't do math on it

        const badges = this._calculateBadgesForRoom(room);
        if (!badges) return; // No badges for some reason

        Object.assign(roomModel, badges);
        this.setState({rooms});
    }

    _appendRoomId(roomId) {
        let room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) return;

        const rooms = this.state.rooms.slice();

        // If the room is upgraded, use that room instead. We'll also splice out
        // any children of the room.
        const history = MatrixClientPeg.get().getRoomUpgradeHistory(roomId);
        if (history.length > 1) {
            room = history[history.length - 1]; // Last room is most recent

            // Take out any room that isn't the most recent room
            for (let i = 0; i < history.length - 1; i++) {
                const idx = rooms.findIndex((r) => r.room.roomId === history[i].roomId);
                if (idx !== -1) rooms.splice(idx, 1);
            }
        }

        const existingIdx = rooms.findIndex((r) => r.room.roomId === room.roomId);
        if (existingIdx !== -1) {
            rooms.splice(existingIdx, 1);
        }

        rooms.splice(0, 0, {room, animated: false});

        if (rooms.length > MAX_ROOMS) {
            rooms.splice(MAX_ROOMS, rooms.length - MAX_ROOMS);
        }
        this.setState({rooms});

        if (this.refs.scroller) {
            this.refs.scroller.moveToOrigin();
        }

        // We don't track room aesthetics (badges, membership, etc) over the wire so we
        // don't need to do this elsewhere in the file. Just where we alter the room IDs
        // and their order.
        const roomIds = rooms.map((r) => r.room.roomId);
        if (roomIds.length > 0) {
            SettingsStore.setValue("breadcrumb_rooms", null, SettingLevel.ACCOUNT, roomIds);
        }
    }

    _viewRoom(room, index) {
        Analytics.trackEvent("Breadcrumbs", "click_node", index);
        dis.dispatch({action: "view_room", room_id: room.roomId});
    }

    _onMouseEnter(room) {
        this._onHover(room);
    }

    _onMouseLeave(room) {
        this._onHover(null); // clear hover states
    }

    _onHover(room) {
        const rooms = this.state.rooms.slice();
        for (const r of rooms) {
            r.hover = room && r.room.roomId === room.roomId;
        }
        this.setState({rooms});
    }

    _isDmRoom(room) {
        const dmRooms = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
        return Boolean(dmRooms);
    }

    render() {
        const Tooltip = sdk.getComponent('elements.Tooltip');
        const IndicatorScrollbar = sdk.getComponent('structures.IndicatorScrollbar');

        // check for collapsed here and not at parent so we keep rooms in our state
        // when collapsing and expanding
        if (this.props.collapsed) {
            return null;
        }

        const rooms = this.state.rooms;
        const avatars = rooms.map((r, i) => {
            const isFirst = i === 0;
            const classes = classNames({
                "mx_RoomBreadcrumbs_crumb": true,
                "mx_RoomBreadcrumbs_preAnimate": isFirst && !r.animated,
                "mx_RoomBreadcrumbs_animate": isFirst,
                "mx_RoomBreadcrumbs_left": r.left,
            });

            let tooltip = null;
            if (r.hover) {
                tooltip = <Tooltip label={r.room.name} />;
            }

            let badge;
            if (r.showCount) {
                const badgeClasses = classNames({
                    'mx_RoomTile_badge': true,
                    'mx_RoomTile_badgeButton': true,
                    'mx_RoomTile_badgeRed': r.redBadge,
                    'mx_RoomTile_badgeUnread': !r.redBadge,
                });

                badge = <div className={badgeClasses}>{r.formattedCount}</div>;
            }

            let dmIndicator;
            if (this._isDmRoom(r.room)) {
                dmIndicator = <img
                    src={require("../../../../res/img/icon_person.svg")}
                    className="mx_RoomBreadcrumbs_dmIndicator"
                    width="13"
                    height="15"
                    alt={_t("Direct Chat")}
                />;
            }

            return (
                <AccessibleButton className={classes} key={r.room.roomId} onClick={() => this._viewRoom(r.room, i)}
                    onMouseEnter={() => this._onMouseEnter(r.room)} onMouseLeave={() => this._onMouseLeave(r.room)}>
                    <RoomAvatar room={r.room} width={32} height={32} />
                    {badge}
                    {dmIndicator}
                    {tooltip}
                </AccessibleButton>
            );
        });
        return (
            <IndicatorScrollbar ref="scroller" className="mx_RoomBreadcrumbs"
                trackHorizontalOverflow={true} verticalScrollsHorizontally={true}>
                { avatars }
            </IndicatorScrollbar>
        );
    }
}
