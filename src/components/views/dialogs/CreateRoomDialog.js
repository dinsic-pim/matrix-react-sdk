/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';
import Tchap from '../../../Tchap';
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import AccessibleButton from "../elements/AccessibleButton";

export default React.createClass({
    displayName: 'CreateRoomDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        const domain = Tchap.getShortDomain();
        return {
            errorText: null,
            visibility: 'private',
            isPublic: false,
            federate: true,
            domain: domain,
            externAllowed: false,
            externAllowedSwitchDisabled: false,
            roomOption: "public",
            classesRoomOptionPrivate: "tc_CreateRoomDialog_RoomOption_private",
            classesRoomOptionExternal: "tc_CreateRoomDialog_RoomOption_external",
            classesRoomOptionPublic: "tc_CreateRoomDialog_RoomOption_public",
        };
    },

    componentDidMount: function() {
        this.setUpRoomOptions(this.state.roomOption);
    },

    onOk: function() {
        if (this.refs.textinput.value.trim().length < 1) {
            this.setState({
                errorText: _t("Room name is required"),
            });
        } else {
            const opts = {
                visibility: this.state.visibility,
                preset: this.state.visibility === 'public' ? 'public_chat' : 'private_chat',
                noFederate: !this.state.federate,
                access_rules: this.state.externAllowed === true ? 'unrestricted' : 'restricted'
            };
            this.props.onFinished(true, this.refs.textinput.value, opts);
        }
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    _onRoomVisibilityRadioToggle: function(ev) {
        if (ev.target.value === "public") {
            this.setState({
                externAllowed: false,
                externAllowedSwitchDisabled: true,
                visibility: ev.target.value,
                federate: false,
            });
        } else {
            this.setState({
                externAllowedSwitchDisabled: false,
                visibility: ev.target.value,
                federate: true,
            });
        }
    },

    _onFederateSwitchChange: function(ev) {
        this.setState({
            federate: !ev
        });
    },

    _onExternAllowedSwitchChange: function(ev) {
        this.setState({
            externAllowed: ev
        });
    },

    onRoomOptionChange: function(ev) {
        ev.preventDefault();
        const selected = ev.target.getAttribute("aria-name")
        this.setUpRoomOptions(selected);
    },

    setUpRoomOptions: function(selected) {
        switch (selected) {
            case "private": {
                this.setState({
                    isPublic: false,
                    externAllowed: false,
                    federate: true,
                    roomOption: selected,
                    classesRoomOptionPrivate: this.state.classesRoomOptionPrivate + " tc_CreateRoomDialog_RoomOption_selected",
                    classesRoomOptionExternal: "tc_CreateRoomDialog_RoomOption_external",
                    classesRoomOptionPublic: "tc_CreateRoomDialog_RoomOption_public",
                })
                break;
            }
            case "external": {
                this.setState({
                    isPublic: false,
                    externAllowed: true,
                    federate: true,
                    roomOption: selected,
                    classesRoomOptionExternal: this.state.classesRoomOptionExternal + " tc_CreateRoomDialog_RoomOption_selected",
                    classesRoomOptionPrivate: "tc_CreateRoomDialog_RoomOption_private",
                    classesRoomOptionPublic: "tc_CreateRoomDialog_RoomOption_public",
                })
                break;
            }
            case "public": {
                this.setState({
                    isPublic: true,
                    externAllowed: false,
                    federate: false,
                    roomOption: selected,
                    classesRoomOptionPublic: this.state.classesRoomOptionPublic + " tc_CreateRoomDialog_RoomOption_selected",
                    classesRoomOptionPrivate: "tc_CreateRoomDialog_RoomOption_private",
                    classesRoomOptionExternal: "tc_CreateRoomDialog_RoomOption_external",
                })
                break;
            }
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const errorText = this.state.errorText;

        let errorTextSection;
        if (errorText) {
            errorTextSection = (
                <div className="mx_AddressPickerDialog_error">
                    { errorText }
                </div>
            );
        }

        let inputAvatarContainerClass = "mx_CreateRoomDialog_input_avatar_container";
        if (this.state.externAllowed) {
            inputAvatarContainerClass += " mx_CreateRoomDialog_input_avatar_container_unrestricted";
        } else {
            inputAvatarContainerClass += " mx_CreateRoomDialog_input_avatar_container_restricted";
        }

        let roomOptions = (
            <div className={"tc_CreateRoomDialog_RoomOption"}>
                <AccessibleButton className={this.state.classesRoomOptionPrivate} onClick={this.onRoomOptionChange} aria-name={"private"}>
                    { _t("Private room") }
                    <div className={"tc_CreateRoomDialog_RoomOption_descr"} onClick={this.onRoomOptionChange} aria-name={"private"}>
                        { _t("Accessible to all gouv.fr users by invitation from an administrator.") }
                    </div>
                </AccessibleButton>
                <AccessibleButton className={this.state.classesRoomOptionExternal} onClick={this.onRoomOptionChange} aria-name={"external"}>
                    { _t("Private room opened to externals") }
                    <div className={"tc_CreateRoomDialog_RoomOption_descr"} onClick={this.onRoomOptionChange} aria-name={"external"}>
                        { _t("Accessible to all gouv.fr users and to external guests by invitation of an administrator.") }
                    </div>
                </AccessibleButton>
                <AccessibleButton className={this.state.classesRoomOptionPublic} onClick={this.onRoomOptionChange} aria-name={"public"}>
                    { _t("Forum room") }
                    <div className={"tc_CreateRoomDialog_RoomOption_descr"} onClick={this.onRoomOptionChange} aria-name={"public"}>
                        { _t("Accessible to all gouv.fr users from the directory or from a shared link.") }
                    </div>
                    <div className={"tc_CreateRoomDialog_RoomOption_suboption"}>
                        <LabelledToggleSwitch label={ _t('Limit access to this room to domain members "%(domain)s"',
                            {domain: Tchap.getShortDomain()}) }
                            onChange={this._onFederateSwitchChange} value={!this.state.federate} />
                    </div>
                </AccessibleButton>
            </div>
        );

        return (
            <BaseDialog className="mx_CreateRoomDialog" onFinished={this.props.onFinished}
                title={_t('Create Room')}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content mx_SettingsTab_section">
                        <div className="mx_CreateRoomDialog_label">
                            <label htmlFor="textinput"> { _t('Room name (required)') } </label>
                        </div>
                        <div className="mx_CreateRoomDialog_input_container">
                            <div className={inputAvatarContainerClass}>
                                <img src={require("../../../../res/img/8b8999.png")} alt="Avatar"/>
                            </div>
                            <input id="textinput" ref="textinput" className="mx_CreateRoomDialog_input" autoFocus={true} />
                        </div>
                        {errorTextSection}
                        <br />
                        { roomOptions }
                    </div>
                </form>
                <DialogButtons primaryButton={_t('Create Room')}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    },
});
