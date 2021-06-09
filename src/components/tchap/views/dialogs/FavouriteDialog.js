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

import React from 'react';
import PropTypes from 'prop-types';
import { _t } from "../../../../languageHandler";
import sdk from "../../../../index";
import MatrixClientPeg from "../../../../MatrixClientPeg";
import FavouriteEventTile from "../favourite/FavouriteEventTile";
import {formatFullDateNoTime} from '../../../../DateUtils';
import dis from "../../../../dispatcher";

export default class FavouriteDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            busy: true,
            errorText: null,
            favEvents: [],
        };
    }

    componentDidMount() {
        try {
            this._retrieveFavEventsData();
        } catch (err) {
            console.error(err);
            this.setState({
                errText: "Error retrieving favourites",
            })
        }
    }

    async _getEvent(room, eventId) {
        const event = room.findEventById(eventId);
        const cli = MatrixClientPeg.get();
        if (event) return event;

        try {
            // ask the client to fetch the event we want using the context API, only interface to do so is to ask
            // for a timeline with that event, but once it is loaded we can use findEventById to look up the ev map
            await cli.getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
        } catch (e) {
            // if it fails catch the error and return early, there's no point trying to find the event in this case.
            // Return null as it is falsey and thus should be treated as an error (as the event cannot be resolved).
            return null;
        }
        return room.findEventById(eventId);
    }

    async _retrieveFavEventsData() {
        const cli = MatrixClientPeg.get();
        const rooms = cli.getRooms();
        const roomsLength = rooms.length;
        let eventObj = [];

        for (let i = 0; i < roomsLength; i++) {
            const taggedEvents = rooms[i].getAccountData("m.tagged_events");

            if (taggedEvents) {
                const eventsId = Object.keys(taggedEvents.event.content.tags["m.favourite"]);

                if (eventsId.length > 0) {
                    for (let j = 0; j < eventsId.length; j++) {
                        const ev = await this._getEvent(rooms[i], eventsId[j])

                        if (ev && Object.keys(ev.getContent()).length !== 0) {
                            eventObj.push({
                                [ev.getId()]: {
                                    event: ev,
                                    origin_server_ts: ev.getTs(),
                                    tagged_at: taggedEvents.event.content.tags["m.favourite"][eventsId[j]].tagged_at,
                                    room: rooms[i]
                                }
                            });
                        }
                    }
                }
            }
        }

        this.setState({
            favEvents: eventObj,
            busy: false,
        })
    }

    _getContent() {
        const data = this.state.favEvents;
        const Spinner = sdk.getComponent("elements.Spinner");
        let content = [];

        if (this.state.busy === true) {
            return <Spinner />;
        } else if (this.state.errorText) {
            return <div>{this.state.errorText}</div>
        }

        if (data) {
            data.sort((a, b) => {
                if (a[Object.keys(a)].origin_server_ts < b[Object.keys(b)].origin_server_ts) return 1;
                if (a[Object.keys(a)].origin_server_ts > b[Object.keys(b)].origin_server_ts) return -1;
                return 0
            })
            for (let i = 0; i < data.length; i++) {
                const ev = data[i][Object.keys(data[i])];
                const roomName = ev.room.name;
                const roomId = ev.room.roomId;
                const messageDate = new Date(ev.origin_server_ts);
                const evPureId = ev.event.event.event_id.substring(1).split(":")[0];

                content.push(
                    <div key={`fav_${evPureId}`} className="tc_FavouritesDialog_eventBlock">
                        <div>
                            <div className="tc_FavouritesDialog_hr">
                                <a onClick={() => {this._onRoomNameClick(roomId)}} className="tc_FavouritesDialog_roomName">
                                    { roomName }
                                </a> - <span className="tc_FavouritesDialog_timestamp">{ formatFullDateNoTime(messageDate) }</span>
                            </div>
                            <div>
                                <FavouriteEventTile mxEvent={ev.event} onFinished={this.props.onFinished}/>
                            </div>
                        </div>
                    </div>
                );

            }
        }
        return content;
    }

    _onRoomNameClick(roomId) {
        dis.dispatch({
            action: "view_room",
            room_id: roomId
        });
        this.props.onFinished();
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const content = this._getContent();

        return (
            <BaseDialog className='tc_FavouritesDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Favourite")}>
                <div className='tc_FavouritesDialog_content'>
                    { content }
                </div>
            </BaseDialog>
        );
    }
}
