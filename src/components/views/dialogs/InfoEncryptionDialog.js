/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd.
Copyright 2019 Bastian Masanek, Noxware IT <matrix@noxware.de>

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
import { _t } from '../../../languageHandler';
import SdkConfig from "../../../SdkConfig";

export default React.createClass({
    displayName: 'InfoEncryptionDialog',
    propTypes: {
        onFinished: PropTypes.func,
    },

    onFinished: function() {
        if (window.localStorage) {
            window.localStorage.setItem("tc_validate_encryption_informations", "done");
        }
        this.props.onFinished();
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <BaseDialog className="mx_InfoDialog" onFinished={this.props.onFinished}
                title={_t("Welcome to Tchap!")}
                contentId='mx_Dialog_content'
                hasCancel={true}
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    <div>
                        <p>{_t("Tchap is the secure instant messaging service of the French State.")}</p>
                        <p>{_t('All exchanges are end-to-end encrypted and accessible only using digital keys saved on your devices (<a>find out more</a>).', {}, {
                            'a': (sub) => <a href={SdkConfig.get().base_host_url + SdkConfig.get().generic_endpoints.encryption_info} rel='noreferrer nofollow noopener' target='_blank'>{sub}</a>,
                        })}</p>
                        <p>{_t("<b>Warning</b>: for an optimal experience, it's recommended to always stay connected.", {}, {
                            'b': (sub) => <b>{sub}</b>,
                        })}</p>
                    </div>
                    <div className="tc_ThreeColumn_block">
                        <div className="tc_ThreeColumn_block_bordered">
                            <div className="tc_ThreeColumn_block_content">
                                <div className="tc_ThreeColumn_block_image">
                                    <img src={require('../../../../res/img/tchap/login-logo.svg')} alt="Login logo" width="50"/>
                                </div>
                                <p>{_t("Stay connected from at least one device")}</p>
                                <p><a href={SdkConfig.get().base_host_url + SdkConfig.get().generic_endpoints.mobile_info} rel='noreferrer nofollow noopener' target='_blank'>{_t("Why?")}</a></p>
                            </div>
                            <p className="tc_ThreeColumn_block_separator">
                                {_t("OR")}
                            </p>
                        </div>
                        <div className="tc_ThreeColumn_block_bordered">
                            <div className="tc_ThreeColumn_block_content">
                                <div className="tc_ThreeColumn_block_image">
                                    <img src={require('../../../../res/img/tchap/tchap-logo.svg')} alt="Tchap logo" width="60"/>
                                </div>
                                <p>{_t("Connect also with the mobile app")}</p>
                                <p><a href={SdkConfig.get().base_host_url + SdkConfig.get().generic_endpoints.mobile_download} rel='noreferrer nofollow noopener' target='_blank'>{_t("Download")}</a></p>
                            </div>
                            <p className="tc_ThreeColumn_block_separator">
                                {_t("OR")}
                            </p>
                        </div>
                        <div className="tc_ThreeColumn_block_last">
                            <div className="tc_ThreeColumn_block_content">
                                <div className="tc_ThreeColumn_block_image">
                                    <img src={require('../../../../res/img/tchap/browser_off-logo.svg')} alt="Browser off logo" width="70"/>
                                </div>
                                <p>{_t("Disable automatic logout on your browser")}</p>
                                <p><a href={SdkConfig.get().base_host_url + SdkConfig.get().generic_endpoints.browser_session_info} rel='noreferrer nofollow noopener' target='_blank'>{_t("How?")}</a></p>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogButtons primaryButton={_t("I understand")}
                    onPrimaryButtonClick={this.onFinished}
                    hasCancel={false}
                >
                </DialogButtons>
            </BaseDialog>
        );
    },
});
