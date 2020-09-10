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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import MatrixClientPeg from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import classNames from 'classnames';
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
const sdk = require("../../../index");
import Modal from '../../../Modal';
import Tchap from '../../../Tchap';
import {RoomPermalinkCreator} from "../../../matrix-to";

// TODO: Merge with ProfileSettings?
export default class RoomProfileSettings extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);

        const client = MatrixClientPeg.get();
        const room = client.getRoom(props.roomId);
        if (!room) throw new Error("Expected a room for ID: ", props.roomId);

        const avatarEvent = room.currentState.getStateEvents("m.room.avatar", "");
        let avatarUrl = avatarEvent && avatarEvent.getContent() ? avatarEvent.getContent()["url"] : null;
        if (avatarUrl) avatarUrl = client.mxcUrlToHttp(avatarUrl, 96, 96, 'crop', false);

        const topicEvent = room.currentState.getStateEvents("m.room.topic", "");
        const topic = topicEvent && topicEvent.getContent() ? topicEvent.getContent()['topic'] : '';

        const nameEvent = room.currentState.getStateEvents('m.room.name', '');
        const name = nameEvent && nameEvent.getContent() ? nameEvent.getContent()['name'] : '';

        const permalinkCreator = new RoomPermalinkCreator(room);
        permalinkCreator.load();
        const link = permalinkCreator.forRoom();

        let link_sharing = false;
        if (client.isRoomEncrypted(props.roomId) && this._getJoinRules(props.roomId) === "public") {
            link_sharing = true;
        }

        this.state = {
            originalDisplayName: name,
            displayName: name,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            originalTopic: topic,
            topic: topic,
            enableProfileSave: false,
            canSetName: room.currentState.maySendStateEvent('m.room.name', client.getUserId()),
            canSetTopic: room.currentState.maySendStateEvent('m.room.topic', client.getUserId()),
            canSetAvatar: room.currentState.maySendStateEvent('m.room.avatar', client.getUserId()),
            accessRules: Tchap.getAccessRules(props.roomId),
            joinRules: Tchap.getJoinRules(room),
            link_sharing,
            link: link,
            copied: false,
            isForumRoom: Tchap.isRoomForum(room)
        };
    }

    _uploadAvatar = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.refs.avatarUpload.click();
    };

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({enableProfileSave: false});

        const client = MatrixClientPeg.get();
        const newState = {};

        // TODO: What do we do about errors?

        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setRoomName(this.props.roomId, this.state.displayName);
            newState.originalDisplayName = this.state.displayName;
        }

        if (this.state.avatarFile) {
            const uri = await client.uploadContent(this.state.avatarFile);
            await client.sendStateEvent(this.props.roomId, 'm.room.avatar', {url: uri}, '');
            newState.avatarUrl = client.mxcUrlToHttp(uri, 96, 96, 'crop', false);
            newState.originalAvatarUrl = newState.avatarUrl;
            newState.avatarFile = null;
        }

        if (this.state.originalTopic !== this.state.topic) {
            await client.setRoomTopic(this.props.roomId, this.state.topic);
            newState.originalTopic = this.state.topic;
        }

        this.setState(newState);
    };

    _onDisplayNameChanged = (e) => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    _onTopicChanged = (e) => {
        this.setState({
            topic: e.target.value,
            enableProfileSave: true,
        });
    };

    _onAvatarChanged = (e) => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                enableProfileSave: false,
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: ev.target.result,
                avatarFile: file,
                enableProfileSave: true,
            });
        };
        reader.readAsDataURL(file);
    };

    _getJoinRules = (roomId) => {
        const stateEventType = "m.room.join_rules";
        const keyName = "join_rule";
        const defaultValue = "public";
        const room = MatrixClientPeg.get().getRoom(roomId);
        const event = room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        const content = event.getContent();
        return keyName in content ? content[keyName] : defaultValue;
    };

    _getGuestAccessRules(room) {
        const stateEventType = "m.room.guest_access";
        const keyName = "guest_access";
        const defaultValue = "can_join";
        const event = room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        const content = event.getContent();
        return keyName in content ? content[keyName] : defaultValue;
    };

    _onExternAllowedSwitchChange = () => {
        const self = this;
        const accessRules = this.state.accessRules;
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Allow the externals to join this room', '', QuestionDialog, {
            title: _t('Allow the externals to join this room'),
            description: ( _t('This action is irreversible.') + " " + _t('Are you sure you want to allow the externals to join this room ?')),
            onFinished: (confirm) => {
                if (confirm) {
                    self.setState({
                        accessRules: 'unrestricted'
                    });
                    MatrixClientPeg.get().sendStateEvent(
                        self.props.roomId, "im.vector.room.access_rules",
                        { rule: 'unrestricted' },
                        "",
                    )
                } else {
                    self.setState({
                        accessRules
                    });
                }
            },
        });
    };

    _onCopyClick = (e) => {
        e.preventDefault();
        const self = this;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(this.state.link).then(function() {
                self.setState({
                    copied: true,
                })
            }, function(err) {
                console.error("navigator.clipboard error. Maybe incompatible ?", err);
            });
        }
    };

    _setJoinRules = (room, joinRules) => {
        const client = MatrixClientPeg.get();
        const self = this;
        client.sendStateEvent(room.roomId, "m.room.join_rules", { join_rule: joinRules }, "").then(() => {
            self.setState({
                link_sharing: joinRules === "public",
                joinRules,
            });
        }).catch((err) => {
            console.error(err);
        });
    };

    _setUpRoomByLink = (room) => {
        const client = MatrixClientPeg.get();
        if (!room.getCanonicalAlias()) {
            let alias = "";
            if (room.name) {
                const tmpAlias = room.name.replace(/[^a-z0-9]/gi, "");
                alias = tmpAlias + this._generateRandomString(7);
            } else {
                alias = this._generateRandomString(7);
            }
            alias = `#${alias}:${client.getDomain()}`;
            client.createAlias(alias, room.roomId).then(() => {
                client.sendStateEvent(room.roomId, "m.room.canonical_alias",
                    { alias }, "").then(() => {
                    this._setJoinRules(room, "public");
                }).catch((err) => {
                    console.error(err)
                });
            }).catch(err => {
                console.error(err);
            });
        } else {
            this._setJoinRules(room, "public");
        }
    };

    _onLinkSharingSwitchChange = (e) => {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        if (e) {
            if (this._getGuestAccessRules(room) === "can_join") {
                client.sendStateEvent(room.roomId, "m.room.guest_access", {guest_access: "forbidden"}, "").then(() => {
                    this._setUpRoomByLink(room);
                }).catch((err) => {
                    console.error(err);
                });
            } else {
                this._setUpRoomByLink(room);
            }
        } else {
            this._setJoinRules(room, "invite");
        }
    };

    _generateRandomString(len) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let str = '';
        for (let i = 0; i < len; i++) {
            let r = Math.floor(Math.random() * charset.length);
            str += charset.substring(r, r + 1);
        }
        return str;
    };

    render() {
        // TODO: Why is rendering a box with an overlay so complicated? Can the DOM be reduced?
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        const isCurrentUserAdmin = room.getMember(client.getUserId()).powerLevelNorm >= 100;
        const permalinkCreator = new RoomPermalinkCreator(room);
        permalinkCreator.load();

        let link = this.state.link;
        const newLink = permalinkCreator.forRoom();
        if (link !== newLink) {
            this.setState({
                link: newLink,
            })
        }

        let showOverlayAnyways = true;
        let avatarElement = <div className="mx_ProfileSettings_avatarPlaceholder" />;
        if (this.state.avatarUrl) {
            showOverlayAnyways = false;
            avatarElement = <img src={this.state.avatarUrl}
                                 alt={_t("Room avatar")} />;
        }

        const avatarOverlayClasses = classNames({
            "mx_ProfileSettings_avatarOverlay": true,
            "mx_ProfileSettings_avatarOverlay_show": showOverlayAnyways,
        });
        let avatarHoverElement = (
            <div className={avatarOverlayClasses} onClick={this._uploadAvatar}>
                <span className="mx_ProfileSettings_avatarOverlayText">{_t("Upload room avatar")}</span>
                <div className="mx_ProfileSettings_avatarOverlayImgContainer">
                    <div className="mx_ProfileSettings_avatarOverlayImg" />
                </div>
            </div>
        );
        if (!this.state.canSetAvatar) {
            if (!showOverlayAnyways) {
                avatarHoverElement = null;
            } else {
                const disabledOverlayClasses = classNames({
                    "mx_ProfileSettings_avatarOverlay": true,
                    "mx_ProfileSettings_avatarOverlay_show": true,
                    "mx_ProfileSettings_avatarOverlay_disabled": true,
                });
                avatarHoverElement = (
                    <div className={disabledOverlayClasses}>
                        <span className="mx_ProfileSettings_noAvatarText">{_t("No room avatar")}</span>
                    </div>
                );
            }
        }

        // As long as the server refuse a mix roomSharing/externAllowed this condition is needed to restric it client-side
        let accessRule = null;
        if (!this.state.isForumRoom && this.state.joinRules === "invite") {
            accessRule = (
                <LabelledToggleSwitch value={this.state.accessRules === "unrestricted"}
                                      onChange={ this._onExternAllowedSwitchChange }
                                      label={ _t('Allow the externals to join this room') }
                                      disabled={ this.state.accessRules === "unrestricted" || !isCurrentUserAdmin} />
            );
        }

        // As long as the server refuse a mix roomSharing/externAllowed this condition is needed to restric it client-side
        let linkSharingUI = null;
        if (!this.state.isForumRoom && this.state.accessRules === "restricted") {
            let linkUrlField = null
            if (this.state.link_sharing) {
                let btnClasses = "tc_LinkSharing_Field_btn_hide";
                if (navigator.clipboard) {
                    btnClasses = "tc_LinkSharing_Field_btn";
                    btnClasses += this.state.copied ? " tc_LinkSharing_Field_btn_selected" : "";
                }
                linkUrlField = (
                    <div className={"tc_LinkSharing_Field"}>
                        <Field
                            id="link_sharing"
                            type="text"
                            value={this.state.link}
                            className={"tc_LinkSharing_Field_input"}
                            disabled={true}
                        />
                        <AccessibleButton onClick={this._onCopyClick} className={btnClasses}>
                            &nbsp;
                        </AccessibleButton>
                    </div>
                );
            }

            let linkSharingSwitchLabel = (
                <div>
                    { _t("Activate link access to this room") }
                    <img className="tc_LinkSharing_Helper" src={require('../../../../res/img/question_mark.svg')}
                        width={20} height={20}
                        title={ _t("Users can join this room with the following link:") }
                        alt={ _t("Room information") } />
                </div>
            );

            linkSharingUI = (
                <div>
                    <LabelledToggleSwitch value={this.state.link_sharing}
                        onChange={ this._onLinkSharingSwitchChange }
                        label={ linkSharingSwitchLabel }
                        disabled={!isCurrentUserAdmin}/>
                    { linkUrlField }
                </div>
            );
        }

        return (
            <form onSubmit={this._saveProfile} autoComplete={false} noValidate={true}>
                <input type="file" ref="avatarUpload" className="mx_ProfileSettings_avatarUpload"
                       onChange={this._onAvatarChanged} accept="image/*" />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <Field id="profileDisplayName" label={_t("Room Name")}
                               type="text" value={this.state.displayName} autoComplete="off"
                               onChange={this._onDisplayNameChanged} disabled={!this.state.canSetName} />
                        <Field id="profileTopic" label={_t("Room Topic")} disabled={!this.state.canSetTopic}
                               type="text" value={this.state.topic} autoComplete="off"
                               onChange={this._onTopicChanged} element="textarea" />
                    </div>
                    <div className="mx_ProfileSettings_avatar">
                        {avatarElement}
                        {avatarHoverElement}
                    </div>
                </div>
                <AccessibleButton onClick={this._saveProfile} kind="primary"
                                  disabled={!this.state.enableProfileSave}>
                    {_t("Save")}
                </AccessibleButton>
                <br />
                <br />
                { accessRule }
                { linkSharingUI }
            </form>
        );
    }
}
