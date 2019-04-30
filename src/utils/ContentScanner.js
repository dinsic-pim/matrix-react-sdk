import MatrixClientPeg from "../MatrixClientPeg";
import 'isomorphic-fetch';
import Promise from "bluebird";
import {decryptFile} from "./DecryptFile";

/**
 * Generating a generic error.
 * @param state {boolean} The state of the file (clean or not).
 * @param message {string} The error message.
 * @returns {{clean: *, error: *}}
 */
function generateError(state, message) {
	return {
		clean: state,
		error: message
	}
}

/**
 * Generate the default settings for the MCS.
 * @returns {object} An object containing the settings.
 */
function generateSettings() {
	const baseUrl = MatrixClientPeg.get()['baseUrl'];
	return {
		publicKeyUrl: `${baseUrl}/_matrix/media_proxy/unstable/public_key`,
		scanEncryptedUrl: `${baseUrl}/_matrix/media_proxy/unstable/scan_encrypted`,
		scanUnencryptedUrl: `${baseUrl}/_matrix/media_proxy/unstable/scan/`,
		downloadUnencryptedUrl: `${baseUrl}/_matrix/media_proxy/unstable/download/`,
		downloadUnencryptedThumnailUrl: `${baseUrl}/_matrix/media_proxy/unstable/thumbnail/`,
		thumbnailParams: '?width=800&height=600&method=scale',
	}
}

/**
 * Scan a Matrix Event content.
 * If the content is a file or an encrypted file, a promise containing the scan result is returned.
 * Thumbnails for image files are not processed because a scan is ran every time a download is called.
 * @param content A Mtrix Event content.
 * @returns {Promise<*>}
 */
export async function scanContent(content) {
	const settings = generateSettings();

	if (content.file !== undefined) {
		// Getting the public key if the server answer
		let publicKey;
		try {
			const publicKeyData = await fetch(settings.publicKeyUrl);
			const publicKeyObject = await publicKeyData.json();
			publicKey = publicKeyObject.public_key;
		} catch (err) {
			console.warn(`Unable to retrieve the publicKey : ${err}`);
		}

		let body;
		if (publicKey) {
			// Setting up the encryption
			const encryption = new global.Olm.PkEncryption();
			encryption.set_recipient_key(publicKey);
			body = {encrypted_body: encryption.encrypt(JSON.stringify({file: content.file}))};
		} else {
			body = {file: content.file};
		}

		return Promise.resolve(fetch(settings.scanEncryptedUrl,{
			headers: {
				'Content-Type': 'application/json'
			},
			method: "POST",
			body: JSON.stringify(body)
		})
			.then(res => { return res.json(); })
			.then(data => {
				return data;
			}).catch(err => {
				console.error(err);
				return generateError(false, 'Error: Unable to join the MCS server')
		}));
	} else if (content.url !== undefined) {
		const fileUrl = content.url.split('//')[1];

		return Promise.resolve(fetch(`${settings.scanUnencryptedUrl}${fileUrl}`)
			.then(res => { return res.json(); })
			.then(data => {
				return data;
			}).catch(err => {
				console.error(err);
				return generateError(false, "Error: Cannot fetch the file");
		}));
	} else {
		return generateError(false, 'Error: This is not a matrix content');
	}
}

/**
 * Download an unencrypted content.
 * @param content A Mtrix Event content.
 * @param isThumb If the requested data will be a thumbnail.
 * @returns {*} A string or an error object.
 */
export function downloadContent(content, isThumb = false) {
	const settings = generateSettings();

	if (content.url !== undefined) {
		let fileUrl = content.url.split('//')[1];
		let url;
		if (isThumb) {
			url = `${settings.downloadUnencryptedThumnailUrl}${fileUrl}${settings.thumbnailParams}`;
		} else {
			url = `${settings.downloadUnencryptedUrl}${fileUrl}`;
		}
		return url;
	} else {
		return generateError(false, 'Error: This is not a matrix content');
	}
}

/**
 * Download an encrypted content.
 * @param content A Mtrix Event content.
 * @param isThumb If the requested data will be a thumbnail.
 * @returns {Promise<*>} A Promise or an error object.
 */
export async function downloadContentEncrypted(content, isThumb = false) {
	if (content.file !== undefined || content.info.thumbnail_file !== undefined) {
		let file = isThumb ? content.info.thumbnail_file : content.file;
		let blob = await decryptFile(file);

		if (blob) {
			return blob;
		} else {
			return new Blob([], {type: 'application/octet-stream'});
		}

	} else {
		return generateError(false, 'Error: This is not a matrix content');
	}
}
