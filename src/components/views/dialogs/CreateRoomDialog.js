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
import MatrixClientPeg from '../../../MatrixClientPeg';
const Modal = require('../../../Modal');

export default React.createClass({
    displayName: 'CreateRoomDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        const cli = MatrixClientPeg.get();
        const baseDomain = cli.getDomain();
        let domain = baseDomain.split('.tchap.gouv.fr')[0].split('.').reverse().filter(Boolean)[0];
        return {
            visibility: 'private',
            isPublic: false,
            federate: false,
            domain: domain,
            externAllowed: false,
            externAllowedSwitchDisabled: false
        };
    },

    componentDidMount: function() {
        const config = SdkConfig.get();
        // Dialog shows inverse of m.federate (noFederate) strict false check to skip undefined check (default = true)
        this.defaultNoFederate = config.default_federate === false;
    },

    onOk: function() {
      if (this.refs.textinput.value === "") {
          const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
          Modal.createTrackedDialog('Room name is needed', '', ErrorDialog, {
              title: _t("Error"),
              description: _t("Room name is required"),
          });
      } else {
        let opts = {
          visibility: this.state.visibility,
          preset: this.state.visibility === 'public' ? 'public_chat' : 'private_chat',
          noFederate: this.refs.checkbox ? this.refs.checkbox.checked : null,
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
                visibility: ev.target.value
            });
        } else {
            this.setState({
                externAllowedSwitchDisabled: false,
                visibility: ev.target.value
            });
        }
    },

    _onExternAllowedCheckboxChange: function() {
        this.setState({
            externAllowed: this.refs.externOpen.checked
        });
    },


    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        let federationOption = null;

        if (this.state.visibility === 'public') {
            federationOption = (
                <div>
                    <input type="checkbox" id="checkbox" ref="checkbox" defaultChecked={this.defaultNoFederate} />
                    <label htmlFor="checkbox">
                        { _t('Limit access to this room to domain members \"%(domain)s\"', {domain: this.state.domain}) }.
                        <br />
                        ({ _t('This setting cannot be changed later!') })
                    </label>
                </div>
            );
        }

        return (
            <BaseDialog className="mx_CreateRoomDialog" onFinished={this.props.onFinished}
                title={_t('Create Room')}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateRoomDialog_label">
                            <label htmlFor="textinput"> { _t('Room name (required)') } </label>
                        </div>
                        <div className="mx_CreateRoomDialog_input_container">
                            <input id="textinput" ref="textinput" className="mx_CreateRoomDialog_input" autoFocus={true} />
                        </div>
                        <br />

                        <label htmlFor="roomVis"> { _t('Room type') } : </label>
                        <label>
                            <input type="radio" name="roomVis" value="private"
                                   onChange={this._onRoomVisibilityRadioToggle}
                                   checked={this.state.visibility === "private"} />
                            { _t('Private') }
                        </label>
                        <label>
                            <input type="radio" name="roomVis" value="public"
                                   onChange={this._onRoomVisibilityRadioToggle}
                                   checked={this.state.visibility !== "private"} />
                            { _t('Public') }
                        </label>
                        <br />
                        <br />
                        <label htmlFor="externOpen"> { _t('Allow the externals to join this room') } : </label>
                        <input type="checkbox" name="externOpen" ref="externOpen"
                               onChange={this._onExternAllowedCheckboxChange}
                               checked={this.state.externAllowed}
                               disabled={this.state.externAllowedSwitchDisabled} />
                        <br />
                        <br />
                        { federationOption }
                    </div>
                </form>
                <DialogButtons primaryButton={_t('Create Room')}
                    onPrimaryButtonClick={this.onOk}
                    onCancel={this.onCancel} />
            </BaseDialog>
        );
    },
});
