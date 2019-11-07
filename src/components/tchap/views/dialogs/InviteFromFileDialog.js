/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018, 2019 New Vector Ltd

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
import { _t, _td } from '../../../../languageHandler';
import sdk from '../../../../index';
import MatrixClientPeg from '../../../../MatrixClientPeg';
import Tchap from '../../../../Tchap';
import * as Email from "../../../../email";


module.exports = React.createClass({
    displayName: "InviteByFileDialog",

    propTypes: {
        title: PropTypes.string.isRequired,
        description: PropTypes.node,
        roomId: PropTypes.string,
        button: PropTypes.string,
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            error: false,
            warning: false,
            errorRestricted: false,
            list: null,
            fileReader: new FileReader(),
        };
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    onInvite: function() {
        this.props.onFinished(true, this.state.list);
    },

    isUserInRoom: function() {

    },

    _handleFileRead: function() {
        const fileReader = this.state.fileReader;
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        console.error("room.getMember");
        Tchap.lookupThreePid("email", "jerome.ploquin4@developpement-durable.gouv.fr").then(r => {
            console.error("RRRRRRRRRRRRR");
            console.dir(r);
            console.dir(room.getMember(r.mxid));
        });
        Tchap.lookupThreePid("email", "test.yoshin@gmail.com").then(r => {
            console.error("22222222222222");
            console.dir(r);
            console.dir(room.getMember(r.mxid));
        });
        Tchap.lookupThreePid("email", "test.test@gmail.com").then(r => {
            console.error("33333333");
            console.dir(r);
            console.dir(room.getMember(r.mxid));
        });
        Tchap.lookupThreePid("email", "jerome.ploquin3@developpement-durable.gouv.fr").then(r => {
            console.error("RRRRRRRRRRRRR");
            console.dir(r);
            console.dir(room.getMember(r.mxid));
        });
        Tchap.lookupThreePid("email", "leo.mora@intradef.gouv.fr").then(r => {
            console.error("IIIIIIIIIIIIIIIIIII");
            console.dir(r);
            console.dir(room.getMember(r.mxid));
        });
        console.dir(room.getMember("jerome.ploquin4@developpement-durable.gouv.fr"));
        console.error("this.props.roomId");
        console.error(this.props.roomId);
        const accessRules = Tchap.getAccessRules(this.props.roomId);

        let list = fileReader.result;
        list = list.replace(/(\r\n|\n|\r)/gm, "");
        list = list.replace(/\s/gm, "");
        let arr = list.split(";");
        let finalList = [];

        console.error("accessRules");
        console.error(accessRules);

        for (let address of arr) {
            if (address) {
                if (Email.looksValid(address)) {
                    if (accessRules === "restricted") {
                        Tchap.getInfo(address).then(res => {
                            if (!Tchap.isUserExternFromServerHostname(res.hs)) {
                                finalList.push(address);
                            } else {
                                this.setState({
                                    errorRestricted: true
                                });
                            }
                        });
                    } else {
                        finalList.push(address);
                    }
                } else {
                    this.setState({
                        error: <div className="mx_AddressPickerDialog_error">{ "Error : This file contains some invalid email address" }</div>,
                        list: null
                    });
                    return;
                }
                console.error(address)
            }
        }

        this.setState({
            list: finalList
        });
    },

    _parseFile: function(file) {
        this.setState({
            error: null,
            warning: null,
            list: null
        });
        console.error(`Size : ${file.size}`);
        if (file.size > 25000) {
            this.setState({
               error: <div className="mx_AddressPickerDialog_error">{ "File too large" }</div>
            });
        } else {
            const fileReader = this.state.fileReader;
            fileReader.onloadend = this._handleFileRead;
            fileReader.readAsText(file);
        }
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let roomParams = null;
        if (this.props.roomId) {
            const ar = Tchap.getAccessRules(this.props.roomId) !== "unrestricted"
                ? _t("Externals aren't allowed to join this room")
                : _t("Externals are allowed to join this room");
            roomParams = (<label>{ar}</label>);
        }

        const inviteNumber = this.state.list ? this.state.list.length : 0;
        const error = this.state.error;
        const warning = this.state.warning;

        let errorRestricted = null;
        if (this.state.errorRestricted) {
            errorRestricted = <div className="mx_AddressPickerDialog_error">{ "Some users are extern. This room is restricted. They will not be invited." }</div>
        }

        return (
            <BaseDialog className="mx_AddressPickerDialog"
                onFinished={this.props.onFinished}
                title={this.props.title}>
                <div className="mx_AddressPickerDialog_label">
                    <label htmlFor="textinput">{ this.props.description }</label>
                    <br />
                    { roomParams }
                </div>
                <div className="mx_Dialog_content">
                    { error }
                    { warning }
                    { errorRestricted }
                    <br />
                    <input type="file"
                        id="import-file"
                        accept=".txt"
                        onChange={e => this._parseFile(e.target.files[0])}
                    />
                </div>
                <DialogButtons primaryButton={_t("Send %(number)s invites", {number: inviteNumber})}
                    onPrimaryButtonClick={this.onInvite}
                    primaryDisabled={!!error || !this.state.list}
                    onCancel={this.onCancel}
                />
            </BaseDialog>
        );
    },
});
