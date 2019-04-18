/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import React from 'react';
import PropTypes from 'prop-types';
import request from 'browser-request';
import { _t } from '../../languageHandler';
import sanitizeHtml from 'sanitize-html';
import sdk from '../../index';
import RoomDirectoryButton from "../views/elements/RoomDirectoryButton";
import StartChatButton from "../views/elements/StartChatButton";
import CreateRoomButton from "../views/elements/CreateRoomButton";
import SettingsButton from "../views/elements/SettingsButton";
import SdkConfig from '../../SdkConfig';
import p from '../../../package';
import * as Users from '../../Users';

class HomePage extends React.Component {
    static displayName = 'HomePage';

    static propTypes = {
        // URL base of the team server. Optional.
        teamServerUrl: PropTypes.string,
        // Team token. Optional. If set, used to get the static homepage of the team
        //      associated. If unset, homePageUrl will be used.
        teamToken: PropTypes.string,
        // URL to use as the iFrame src. Defaults to /home.html.
        homePageUrl: PropTypes.string,
    };

    state = {
            iframeSrc: '',
            page: '',
    };

    translate(s) {
        // default implementation - skins may wish to extend this
        return sanitizeHtml(_t(s));
    }

    componentWillMount() {
        this._unmounted = false;

        if (this.props.teamToken && this.props.teamServerUrl) {
            this.setState({
                iframeSrc: `${this.props.teamServerUrl}/static/${this.props.teamToken}/home.html`
            });
        }
        else {
            // we use request() to inline the homepage into the react component
            // so that it can inherit CSS and theming easily rather than mess around
            // with iframes and trying to synchronise document.stylesheets.

            let src = this.props.homePageUrl || 'home.html';

            request(
                { method: "GET", url: src },
                (err, response, body) => {
                    if (this._unmounted) {
                        return;
                    }

                    if (err || response.status < 200 || response.status >= 300) {
                        console.warn(`Error loading home page: ${err}`);
                        this.setState({ page: _t("Couldn't load home page") });
                        return;
                    }

                    body = body.replace(/_t\(['"]([\s\S]*?)['"]\)/mg, (match, g1)=>this.translate(g1));
                    this.setState({ page: body });
                }
            );
        }
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    render() {
        if (this.state.iframeSrc) {
            return (
                <div className="mx_HomePage">
                    <iframe src={ this.state.iframeSrc } />
                </div>
            );
        }
        else {
            const GeminiScrollbarWrapper = sdk.getComponent("elements.GeminiScrollbarWrapper");
            const TintableSvg = sdk.getComponent("elements.TintableSvg");
            const faqUrl = `${SdkConfig.get()['host_url']}/faq/`;
            const version = p.appVersion;
            const isUserExtern = Users.isCurrentUserExtern();

            const welcomePageRowOne = (
                <div className="tc_HomePage_GroupElement tc_HomePage_ThreeGroupElement">
                    <div className="tc_HomePage_Element">
                        <div className="tc_HomePage_Element_Button tc_HomePage_Element_StartChat">
                            <StartChatButton size="160" callout={true}/>
                        </div>
                        <hr />
                        <span className="tc_HomePage_Element_Descr">Rechercher un utilisateur Tchap<br />et lancer une discussion<br />(ou inviter un contact par son courriel)</span>
                    </div>
                    <div className="tc_HomePage_Element">
                        <div className="tc_HomePage_Element_Button tc_HomePage_Element_CreateRoom">
                            <CreateRoomButton size="160" callout={true}/>
                        </div>
                        <hr />
                        <span className="tc_HomePage_Element_Descr">Créer un salon<br />et inviter des utilisateurs<br />à le rejoindre</span>
                    </div>
                    <div className="tc_HomePage_Element">
                        <div className="tc_HomePage_Element_Button tc_HomePage_Element_RoomDirectory">
                            <RoomDirectoryButton size="160" callout={true}/>
                        </div>
                        <hr />
                        <span className="tc_HomePage_Element_Descr">Consulter la liste<br />et rejoindre un salon public</span>
                    </div>
                </div>
            );

            const welcomePageRowTwo = (
                <div className="tc_HomePage_GroupElement tc_HomePage_TwoGroupElement">
                    <div className="tc_HomePage_Element">
                        <div className="tc_HomePage_Element_Button tc_HomePage_Element_Settings">
                            <SettingsButton size="120" callout={true}/>
                        </div>
                        <hr />
                        <span className="tc_HomePage_Element_Descr">Personnaliser le compte,<br />changer le mot de passe,<br />gérer les notifications, se déconnecter,...</span>
                    </div>
                    <div className="tc_HomePage_Element">
                        <a href={faqUrl} className="tc_HomePage_Element_Button tc_HomePage_Element_Faq" target="_blank"></a>
                        <hr />
                    </div>
                </div>
            );

            return (
                <GeminiScrollbarWrapper autoshow={true} className="tc_HomePage">
                    <div className="tc_HomePage_Element_Logo">
                        <TintableSvg src="img/logos/tchap-logo.svg" width="120" height="120" />
                        <p className="tc_HomePage_GroupElement_Descr">Tchap</p>
                    </div>
                    {isUserExtern ? null : welcomePageRowOne}
                    {isUserExtern ? null : welcomePageRowTwo}
                    <div className="tc_HomePage_Version">Version {version}</div>
                </GeminiScrollbarWrapper>
            );
        }
    }
}

module.exports = HomePage;
