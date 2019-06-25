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

    static async requestNewExpiredAccountEmail() {
        const sendEmailUrl = "/_matrix/client/unstable/account_validity/send_mail";
        const homeserverUrl = MatrixClientPeg.get().getHomeserverUrl();
        const accessToken = MatrixClientPeg.get().getAccessToken();
        const url = `${homeserverUrl}${sendEmailUrl}`;
        const options = {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        };

        console.error("urlurlurlurlurlurlurlurlurlurlurlurlurl");
        console.error(url);
        const res = await fetch(url, options);
        const json = await res.json();
    }
}

module.exports = Tchap;
