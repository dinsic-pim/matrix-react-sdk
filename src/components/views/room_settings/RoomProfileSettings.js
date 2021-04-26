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
import * as ContextualMenu from "../../structures/ContextualMenu";
import Dropdown from "../elements/Dropdown";

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

        let linkSharing = false;
        if ((client.isRoomEncrypted(props.roomId) && this._getJoinRules(props.roomId) === "public") ||
            Tchap.isRoomForum(room)) {
            linkSharing = true;
        }

        const retentionEvent = room.currentState.getStateEvents("m.room.retention", '');
        const maxLifetime = retentionEvent && retentionEvent.event.content.max_lifetime ?
            retentionEvent.event.content.max_lifetime :
            0;

        this._onCopyClick = this._onCopyClick.bind(this);
        this._onLinkClick = this._onLinkClick.bind(this);
        this._validRoomRetentionTime = this._validRoomRetentionTime.bind(this);

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
            linkSharing: linkSharing,
            link: link,
            copied: false,
            isForumRoom: Tchap.isRoomForum(room),
            retentionTime: Tchap.msToDay(maxLifetime),
            originalRetentionTime: Tchap.msToDay(maxLifetime),
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

        if (this.state.originalRetentionTime !== this.state.retentionTime) {
            this._validRoomRetentionTime();
            newState.originalRetentionTime = this.state.retentionTime;
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
                    MatrixClientPeg.get().sendStateEvent(
                        self.props.roomId, "im.vector.room.access_rules",
                        { rule: 'unrestricted' },
                        "",
                    ).then(() => {
                        self.setState({
                            accessRules: 'unrestricted'
                        });
                    }).catch(err => {
                        console.error(err)
                        self.setState({
                            accessRules
                        });
                        if (err.errcode === "M_FORBIDDEN" && self.state.joinRules === "public") {
                            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                            Modal.createTrackedDialog('Failure to open to externs', '', ErrorDialog, {
                                title: _t("Failed to open this room to externs"),
                                description: _t("This change is not currently supported because this room is accessible by link."),
                            });
                        }
                    })
                } else {
                    self.setState({
                        accessRules
                    });
                }
            },
        });
    };

    _setJoinRules = (room, joinRules) => {
        const client = MatrixClientPeg.get();
        const self = this;
        client.sendStateEvent(room.roomId, "m.room.join_rules", { join_rule: joinRules }, "").then(() => {
            self.setState({
                linkSharing: joinRules === "public",
                joinRules,
            });
        }).catch((err) => {
            console.error(err);
            if (err.errcode === "M_FORBIDDEN" && this.state.accessRules === "unrestricted") {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Failure to open link access', '', ErrorDialog, {
                    title: _t("Failed to open link access for this room"),
                    description: _t("This change is not currently supported because externs are allowed to join this room."),
                });
            }
        });
    };

    _setUpRoomByLink = (room) => {
        const client = MatrixClientPeg.get();
        if (!room.getCanonicalAlias()) {
            let alias = "";
            if (room.name) {
                const tmpAlias = room.name.replace(/[^a-z0-9]/gi, "");
                alias = tmpAlias + this._generateRandomString(11);
            } else {
                alias = this._generateRandomString(11);
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

    _onLinkSharingSwitchChange = (event) => {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);
        if (event) {
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

    _selectText(target) {
        const range = document.createRange();
        range.selectNodeContents(target);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    };

    _onLinkClick(e) {
        e.preventDefault();
        const {target} = e;
        this._selectText(target);
    };

    _onCopyClick(e) {
        e.preventDefault();

        this._selectText(this.refs.link);

        let successful;
        try {
            successful = document.execCommand('copy');
        } catch (err) {
            console.error('Failed to copy: ', err);
        }

        const GenericTextContextMenu = sdk.getComponent('context_menus.GenericTextContextMenu');
        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;
        const {close} = ContextualMenu.createMenu(GenericTextContextMenu, {
            chevronOffset: 10,
            left: x,
            top: y,
            message: successful ? _t('Copied!') : _t('Failed to copy'),
        }, false);
        e.target.onmouseleave = close;
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

    _onRetentionChange = (e) => {
        let retentionValue = e;
        retentionValue = retentionValue < 0 ? 0 : retentionValue;
        retentionValue = retentionValue > 365 ? 365 : retentionValue;
        retentionValue = Number(retentionValue);

        if (retentionValue !== this.state.originalRetentionTime) {
            this.setState({
                enableProfileSave: true,
                retentionTime: retentionValue,
            });
        } else {
            this.setState({
                enableProfileSave: false,
                retentionTime: this.state.originalRetentionTime,
            });
        }
    };

    _validRoomRetentionTime() {
        let retentionObj = {};
        if (this.state.retentionTime > 0) {
            retentionObj = {max_lifetime: Tchap.dayToMs(this.state.retentionTime), expire_on_clients: true}
        }
        MatrixClientPeg.get().sendStateEvent(
            this.props.roomId, "m.room.retention",
            retentionObj,
            ''
        ).catch(err => {
            console.error(err)
        });
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

        let accessRule = null;
        if (!this.state.isForumRoom) {
            accessRule = (
                <LabelledToggleSwitch value={this.state.accessRules === "unrestricted"}
                                      onChange={ this._onExternAllowedSwitchChange }
                                      label={ _t('Allow the externals to join this room') }
                                      disabled={ this.state.accessRules === "unrestricted" || !isCurrentUserAdmin} />
            );
        }

        let warningSharingExtern = null;
        if (this.state.accessRules === "unrestricted" && this.state.joinRules === "public") {
            warningSharingExtern = (
                <div className="tc_ExternSharing_warning">
                    <img src={require("../../../../res/img/tchap/warning.svg")} width="16" height="16"  alt="warning" />
                    <span>{ _t("An invitation is still required for externs, although link access is enabled.") }</span>
                </div>
            );
        }

        let linkUrlField = null;
        if (this.state.linkSharing) {
            linkUrlField = (
                <div className="mx_ShareDialog_matrixto tc_ShareDialog">
                    <a ref="link"
                        href={this.state.link}
                        onClick={this._onLinkClick}
                        className="mx_ShareDialog_matrixto_link"
                    >
                        { this.state.link }
                    </a>
                    <a href={this.state.link} className="mx_ShareDialog_matrixto_copy" onClick={this._onCopyClick}>
                        { _t('COPY') }
                        <div>&nbsp;</div>
                    </a>
                </div>
            );
        }

        const linkSharingSwitchLabel = (
            <div>
                { _t("Activate link access to this room") }
                <img className="tc_LinkSharing_Helper" src={require('../../../../res/img/question_mark.svg')}
                    width={20} height={20}
                    title={ _t("Users can join this room with the following link:") }
                    alt={ _t("Room information") } />
            </div>
        );

        const linkSharingUI = (
            <div>
                <LabelledToggleSwitch value={this.state.linkSharing}
                    onChange={ this._onLinkSharingSwitchChange }
                    label={ linkSharingSwitchLabel }
                    disabled={!isCurrentUserAdmin || Tchap.isRoomForum(room)}/>
                { warningSharingExtern }
                { linkUrlField }
            </div>
        );


        let roomRetention = (
            <div className="mx_ProfileSettings_retention_block">
                <span className="mx_ProfileSettings_retention_text">{ _t("History duration: ") }</span>
                <Dropdown className="mx_ProfileSettings_retention_select" onOptionChange={this._onRetentionChange}
                    value={String(this.state.retentionTime)} disabled={!isCurrentUserAdmin}>
                    <option value="0" key="0">{ _t("Unlimited") }</option>
                    <option value="365" key="365">{ _t("1 year") }</option>
                    <option value="180" key="180">{ _t("6 months") }</option>
                    <option value="30" key="30">{ _t("1 month") }</option>
                    <option value="7" key="7">{ _t("1 week") }</option>
                    <option value="1" key="1">{ _t("1 day") }</option>
                </Dropdown>
            </div>
        );

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
                { roomRetention }
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
