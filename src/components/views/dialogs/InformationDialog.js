/*
 * Usage:
 * Modal.createTrackedDialog('An Identifier', 'some detail', InformationDialog, {
 *   title: "some text", (default: "Information")
 *   description: "some more text",
 *   button: "Button Text",
 *   onFinished: someFunction,
 *   focus: true|false (default: true)
 * });
 */

import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default React.createClass({
    displayName: 'InformationDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.string,
        ]),
        button: PropTypes.string,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
    },

    getDefaultProps: function() {
        return {
            focus: true,
            title: null,
            description: null,
            button: null,
        };
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className="mx_ErrorDialog" onFinished={this.props.onFinished}
                    title={this.props.title || _t('Information')}
                    contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    { this.props.description || _t('Information') }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onFinished} autoFocus={this.props.focus}>
                        { this.props.button || _t('OK') }
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
