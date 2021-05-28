/*
Copyright 2021 New Vector Ltd

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

'use strict';


import ReplyThread from "../../../views/elements/ReplyThread";

const React = require('react');
import PropTypes from 'prop-types';
const classNames = require("classnames");
import { _t, _td } from '../../../../languageHandler';
const Modal = require('../../../../Modal');

const sdk = require('../../../../index');
const TextForEvent = require('../../../../TextForEvent');
import withMatrixClient from '../../../../wrappers/withMatrixClient';

const ContextualMenu = require('../../../structures/ContextualMenu');
import dis from '../../../../dispatcher';
import SettingsStore from "../../../../settings/SettingsStore";
import {EventStatus} from 'matrix-js-sdk';
import {RoomPermalinkCreator} from "../../../../matrix-to";

const ObjectUtils = require('../../../../ObjectUtils');

const eventTileTypes = {
    'm.room.message': 'messages.MessageEvent',
    'm.sticker': 'messages.MessageEvent',
    'm.call.invite': 'messages.TextualEvent',
    'm.call.answer': 'messages.TextualEvent',
    'm.call.hangup': 'messages.TextualEvent',
};

const stateEventTileTypes = {
    'm.room.aliases': 'messages.TextualEvent',
    // 'm.room.aliases': 'messages.RoomAliasesEvent', // too complex
    'm.room.canonical_alias': 'messages.TextualEvent',
    'm.room.create': 'messages.RoomCreate',
    'm.room.member': 'messages.TextualEvent',
    'm.room.name': 'messages.TextualEvent',
    'm.room.avatar': 'messages.RoomAvatarEvent',
    'm.room.third_party_invite': 'messages.TextualEvent',
    'm.room.history_visibility': 'messages.TextualEvent',
    'm.room.encryption': 'messages.TextualEvent',
    'm.room.topic': 'messages.TextualEvent',
    'm.room.power_levels': 'messages.TextualEvent',
    'm.room.pinned_events': 'messages.TextualEvent',
    'm.room.server_acl': 'messages.TextualEvent',
    'im.vector.modular.widgets': 'messages.TextualEvent',
    'm.room.tombstone': 'messages.TextualEvent',
    'm.room.join_rules': 'messages.TextualEvent',
    'm.room.guest_access': 'messages.TextualEvent',
    'm.room.related_groups': 'messages.TextualEvent',
};

function getHandlerTile(ev) {
    const type = ev.getType();
    return ev.isState() ? stateEventTileTypes[type] : eventTileTypes[type];
}

const MAX_READ_AVATARS = 5;

// Our component structure for EventTiles on the timeline is:
//
// .-EventTile------------------------------------------------.
// | MemberAvatar (SenderProfile)                   TimeStamp |
// |    .-{Message,Textual}Event---------------. Read Avatars |
// |    |   .-MFooBody-------------------.     |              |
// |    |   |  (only if MessageEvent)    |     |              |
// |    |   '----------------------------'     |              |
// |    '--------------------------------------'              |
// '----------------------------------------------------------'

module.exports = withMatrixClient(React.createClass({
    displayName: 'FavouriteEventTile',

    propTypes: {
        /* MatrixClient instance for sender verification etc */
        matrixClient: PropTypes.object.isRequired,

        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* true if mxEvent is redacted. This is a prop because using mxEvent.isRedacted()
         * might not be enough when deciding shouldComponentUpdate - prevProps.mxEvent
         * references the same this.props.mxEvent.
         */
        isRedacted: PropTypes.bool,

        /* true if this is a continuation of the previous event (which has the
         * effect of not showing another avatar/displayname
         */
        continuation: PropTypes.bool,

        /* true if this is the last event in the timeline (which has the effect
         * of always showing the timestamp)
         */
        last: PropTypes.bool,

        /* true if this is search context (which has the effect of greying out
         * the text
         */
        contextual: PropTypes.bool,

        /* a list of words to highlight, ordered by longest first */
        highlights: PropTypes.array,

        /* link URL for the highlights */
        highlightLink: PropTypes.string,

        /* should show URL previews for this event */
        showUrlPreview: PropTypes.bool,

        /* is this the focused event */
        isSelectedEvent: PropTypes.bool,

        /* callback called when dynamic content in events are loaded */
        onHeightChanged: PropTypes.func,

        /* a list of read-receipts we should show. Each object has a 'roomMember' and 'ts'. */
        readReceipts: PropTypes.arrayOf(React.PropTypes.object),

        /* opaque readreceipt info for each userId; used by ReadReceiptMarker
         * to manage its animations. Should be an empty object when the room
         * first loads
         */
        readReceiptMap: PropTypes.object,

        /* A function which is used to check if the parent panel is being
         * unmounted, to avoid unnecessary work. Should return true if we
         * are being unmounted.
         */
        checkUnmounting: PropTypes.func,

        /* the status of this event - ie, mxEvent.status. Denormalised to here so
         * that we can tell when it changes. */
        eventSendStatus: PropTypes.string,

        /* the shape of the tile. by default, the layout is intended for the
         * normal room timeline.  alternative values are: "file_list", "file_grid"
         * and "notif".  This could be done by CSS, but it'd be horribly inefficient.
         * It could also be done by subclassing EventTile, but that'd be quite
         * boiilerplatey.  So just make the necessary render decisions conditional
         * for now.
         */
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            // no-op function because onHeightChanged is optional yet some sub-components assume its existence
            onHeightChanged: function() {},
        };
    },

    getInitialState: function() {
        return {
            // Whether the context menu is being displayed.
            menu: false,
            // Whether the event's sender has been verified.
            verified: null,
            // Whether onRequestKeysClick has been called since mounting.
            previouslyRequestedKeys: false,
            permalinkCreator: null,
        };
    },

    componentWillMount: function() {
        const room = this.props.matrixClient.getRoom(this.props.mxEvent.getRoomId());
        const permalinkCreator = new RoomPermalinkCreator(room);
        permalinkCreator.load();
        this.setState({permalinkCreator});
        // don't do RR animations until we are mounted
        this._suppressReadReceiptAnimation = true;
        this._verifyEvent(this.props.mxEvent);
    },

    componentDidMount: function() {
        this._suppressReadReceiptAnimation = false;
        this.props.matrixClient.on("deviceVerificationChanged",
            this.onDeviceVerificationChanged);
        this.props.mxEvent.on("Event.decrypted", this._onDecrypted);
    },

    componentWillReceiveProps: function(nextProps) {
        // re-check the sender verification as outgoing events progress through
        // the send process.
        if (nextProps.eventSendStatus !== this.props.eventSendStatus) {
            this._verifyEvent(nextProps.mxEvent);
        }
    },

    componentWillUnmount: function() {
        const client = this.props.matrixClient;
        client.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        this.props.mxEvent.removeListener("Event.decrypted", this._onDecrypted);
    },

    /** called when the event is decrypted after we show it.
     */
    _onDecrypted: function() {
        // we need to re-verify the sending device.
        // (we call onHeightChanged in _verifyEvent to handle the case where decryption
        // has caused a change in size of the event tile)
        this._verifyEvent(this.props.mxEvent);
        this.forceUpdate();
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (userId === this.props.mxEvent.getSender()) {
            this._verifyEvent(this.props.mxEvent);
        }
    },

    _verifyEvent: async function(mxEvent) {
        if (!mxEvent.isEncrypted()) {
            return;
        }

        const verified = await this.props.matrixClient.isEventSenderVerified(mxEvent);
        this.setState({
            verified: verified,
        }, () => {
            // Decryption may have caused a change in size
            this.props.onHeightChanged();
        });
    },

    onRequestKeysClick: function() {
        this.setState({
            // Indicate in the UI that the keys have been requested (this is expected to
            // be reset if the component is mounted in the future).
            previouslyRequestedKeys: true,
        });

        // Cancel any outgoing key request for this event and resend it. If a response
        // is received for the request with the required keys, the event could be
        // decrypted successfully.
        this.props.matrixClient.cancelAndResendEventRoomKeyRequest(this.props.mxEvent);
    },

    onPermalinkClicked: function(e) {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Riot when clicked.
        e.preventDefault();
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
        this.props.onFinished();
    },

    render: function() {
        const MessageTimestamp = sdk.getComponent('messages.MessageTimestamp');
        const SenderProfile = sdk.getComponent('messages.SenderProfile');
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

        //console.log("EventTile showUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        const content = this.props.mxEvent.getContent();
        const msgtype = content.msgtype;
        const eventType = this.props.mxEvent.getType();

        // Info messages are basically information about commands processed on a room
        const isInfoMessage = (
            eventType !== 'm.room.message' && eventType !== 'm.sticker' && eventType != 'm.room.create'
        );

        const tileHandler = getHandlerTile(this.props.mxEvent);
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!tileHandler) {
            const {mxEvent} = this.props;
            const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
            console.warn(`Event type not supported: type:${mxEvent.getType()} isState:${mxEvent.isState()}`);
            return <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">
                    <InlineSpinner />
                </div>
            </div>;
        }
        const EventTileType = sdk.getComponent(tileHandler);
        const isEncryptionFailure = this.props.mxEvent.isDecryptionFailure();

        const classes = classNames({
            mx_EventTile: true,
            mx_EventTile_contextual: this.props.contextual,
            menu: this.state.menu,
            mx_EventTile_emote: msgtype === 'm.emote',
        });

        let permalink = "#";
        if (this.state.permalinkCreator) {
            permalink = this.state.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }


        let avatar;
        let sender;
        let avatarSize;
        let needsSenderProfile;

        if (this.props.tileShape === "notif") {
            avatarSize = 24;
            needsSenderProfile = true;
        } else if (tileHandler === 'messages.RoomCreate') {
            avatarSize = 0;
            needsSenderProfile = false;
        } else if (isInfoMessage) {
            // a small avatar, with no sender profile, for
            // joins/parts/etc
            avatarSize = 14;
            needsSenderProfile = false;
        } else if (this.props.continuation && this.props.tileShape !== "file_grid") {
            // no avatar or sender profile for continuation messages
            avatarSize = 0;
            needsSenderProfile = false;
        } else {
            avatarSize = 30;
            needsSenderProfile = true;
        }

        if (this.props.mxEvent.sender && avatarSize) {
            avatar = (
                <div className="mx_EventTile_avatar">
                    <MemberAvatar member={this.props.mxEvent.sender}
                        width={avatarSize} height={avatarSize}
                        viewUserOnClick={false}
                    />
                </div>
            );
        }

        if (needsSenderProfile) {
            let text = null;
            if (!this.props.tileShape || this.props.tileShape === 'reply' || this.props.tileShape === 'reply_preview') {
                if (msgtype === 'm.image') text = _td('%(senderName)s sent an image');
                else if (msgtype === 'm.video') text = _td('%(senderName)s sent a video');
                else if (msgtype === 'm.file') text = _td('%(senderName)s uploaded a file');
                sender = <SenderProfile
                    mxEvent={this.props.mxEvent}
                    enableFlair={!text}
                    text={text}
                    onClick={this.onPermalinkClicked} />;
            } else {
                sender = <SenderProfile mxEvent={this.props.mxEvent} enableFlair={true} onClick={this.onPermalinkClicked} />;
            }
        }

        const timestamp = this.props.mxEvent.getTs() ?
            <MessageTimestamp showTwelveHour={this.props.isTwelveHour} ts={this.props.mxEvent.getTs()} /> : null;

        const keyRequestHelpText =
            <div className="mx_EventTile_keyRequestInfo_tooltip_contents">
                <p>
                    { this.state.previouslyRequestedKeys ?
                        _t( 'Your key share request has been sent - please check your other devices ' +
                            'for key share requests.') :
                        _t( 'Key share requests are sent to your other devices automatically. If you ' +
                            'rejected or dismissed the key share request on your other devices, click ' +
                            'here to request the keys again.')
                    }
                </p>
                <p>
                    { _t( 'If your other devices do not have the key for this message you will not ' +
                        'be able to decrypt them.')
                    }
                </p>
            </div>;
        const keyRequestInfoContent = this.state.previouslyRequestedKeys ?
            _t('Request in progress...') :
            _t(
                'Request sent. <requestLink>Resend</requestLink>.',
                {},
                {'requestLink': (sub) => <a onClick={this.onRequestKeysClick}>{ sub }</a>},
            );

        const ToolTipButton = sdk.getComponent('elements.ToolTipButton');
        const keyRequestInfo = isEncryptionFailure ?
            <div className="mx_EventTile_keyRequestInfo">
                <span className="mx_EventTile_keyRequestInfo_text">
                    { keyRequestInfoContent }
                </span>
                <ToolTipButton helpText={keyRequestHelpText} />
            </div> : null;

        switch (this.props.tileShape) {
            case 'notif': {
                const EmojiText = sdk.getComponent('elements.EmojiText');
                const room = this.props.matrixClient.getRoom(this.props.mxEvent.getRoomId());
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_roomName">
                            <EmojiText element="a" href={permalink} onClick={this.onPermalinkClicked}>
                                { room ? room.name : '' }
                            </EmojiText>
                        </div>

                        <div className="mx_EventTile_senderDetails">
                            { avatar }
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { sender }
                                { timestamp }
                            </a>
                        </div>
                        <div className="mx_EventTile_line" >
                            <EventTileType ref="tile"
                                mxEvent={this.props.mxEvent}
                                highlights={this.props.highlights}
                                highlightLink={this.props.highlightLink}
                                showUrlPreview={this.props.showUrlPreview}
                                onHeightChanged={this.props.onHeightChanged} />
                        </div>
                    </div>
                );
            }
            case 'file_grid': {
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_line" >
                            <EventTileType ref="tile"
                                mxEvent={this.props.mxEvent}
                                highlights={this.props.highlights}
                                highlightLink={this.props.highlightLink}
                                showUrlPreview={this.props.showUrlPreview}
                                tileShape={this.props.tileShape}
                                onHeightChanged={this.props.onHeightChanged} />
                        </div>
                        <a
                            className="mx_EventTile_senderDetailsLink"
                            href={permalink}
                            onClick={this.onPermalinkClicked}
                        >
                            <div className="mx_EventTile_senderDetails">
                                { sender }
                                { timestamp }
                            </div>
                        </a>
                    </div>
                );
            }

            case 'reply':
            case 'reply_preview': {
                let thread;
                if (this.props.tileShape === 'reply_preview') {
                    thread = ReplyThread.makeThread(
                        this.props.mxEvent,
                        this.props.onHeightChanged,
                        this.state.permalinkCreator,
                        'replyThread',
                    );
                }
                return (
                    <div className={classes}>
                        { avatar }
                        { sender }
                        <div className="mx_EventTile_reply">
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { timestamp }
                            </a>
                            { thread }
                            <EventTileType ref="tile"
                                mxEvent={this.props.mxEvent}
                                highlights={this.props.highlights}
                                highlightLink={this.props.highlightLink}
                                onHeightChanged={this.props.onHeightChanged}
                                showUrlPreview={false} />
                        </div>
                    </div>
                );
            }
            default: {
                const thread = ReplyThread.makeThread(
                    this.props.mxEvent,
                    this.props.onHeightChanged,
                    this.state.permalinkCreator,
                    'replyThread',
                );
                return (
                    <div className={classes}>
                        { sender }
                        <div className="mx_EventTile_line">
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { timestamp }
                            </a>
                            { thread }
                            <EventTileType ref="tile"
                                mxEvent={this.props.mxEvent}
                                highlights={this.props.highlights}
                                highlightLink={this.props.highlightLink}
                                showUrlPreview={this.props.showUrlPreview}
                                onHeightChanged={this.props.onHeightChanged} />
                            { keyRequestInfo }
                        </div>
                        {
                            // The avatar goes after the event tile as it's absolutly positioned to be over the
                            // event tile line, so needs to be later in the DOM so it appears on top (this avoids
                            // the need for further z-indexing chaos)
                        }
                        { avatar }
                    </div>
                );
            }
        }
    },
}));

// XXX this'll eventually be dynamic based on the fields once we have extensible event types
const messageTypes = ['m.room.message', 'm.sticker'];
function isMessageEvent(ev) {
    return (messageTypes.includes(ev.getType()));
}

module.exports.haveTileForEvent = function(e) {
    // Only messages have a tile (black-rectangle) if redacted
    if (e.isRedacted() && !isMessageEvent(e)) return false;

    const handler = getHandlerTile(e);
    if (handler === undefined) return false;
    if (handler === 'messages.TextualEvent') {
        return TextForEvent.textForEvent(e) !== '';
    } else if (handler === 'messages.RoomCreate') {
        return Boolean(e.getContent()['predecessor']);
    } else {
        return true;
    }
};

module.exports.getHandlerTile = getHandlerTile;
