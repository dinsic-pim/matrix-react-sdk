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
        const hostBase = "https://matrix.";
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

        return fetch(url, options).then(res => res.json())
            .catch(err => {
                console.log("Lookup : Use the MatrixClientPeg lookup");
                return MatrixClientPeg.get().lookupThreePid(medium, address);
            });
    }
}

module.exports = Tchap;
