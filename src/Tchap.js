import MatrixClientPeg from './MatrixClientPeg';

/**
 * Tchap utils.
 */
class Tchap {

    /**
     *
     * @param {string} medium
     * @param {string} address
     * @returns {Object}
     */
    static lookupThreePid(medium, address) {
        const hostBase = "https://";
        const lookupUrl = "/_matrix/client/unstable/account/3pid/lookup";
        const homeserverUrl = MatrixClientPeg.get().getHomeserverUrl();
        const homeserverName = MatrixClientPeg.get().getIdentityServerUrl().split(hostBase)[1];
        const accessToken = MatrixClientPeg.get().getAccessToken();
        const url = `${homeserverUrl}${lookupUrl}?medium=${medium}&address=${address}&id_server=${homeserverName}`;
        const options = {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        };

        return fetch(url, options).then(res => {
            if (res.status && res.status !== 200) {
                console.log("Lookup : Use the MatrixClientPeg lookup");
                return MatrixClientPeg.get().lookupThreePid(medium, address);
            } else {
                return res.json();
            }
        }).catch(err => {
            console.log("Lookup : Use the MatrixClientPeg lookup");
            return MatrixClientPeg.get().lookupThreePid(medium, address);
        });
    }

    static getAccessRules(roomId) {
        const stateEventType = "im.vector.room.access_rules";
        const keyName = "rule";
        const defaultValue = "";
        const room = MatrixClientPeg.get().getRoom(roomId);
        const event = room.currentState.getStateEvents(stateEventType, '');
        if (!event) {
            return defaultValue;
        }
        const content = event.getContent();
        return keyName in content ? content[keyName] : defaultValue;
    }
}

module.exports = Tchap;
