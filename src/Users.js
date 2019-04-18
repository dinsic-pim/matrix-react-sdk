import MatrixClientPeg from './MatrixClientPeg';

/**
 * If the logged-in user is from an external Homeserver,
 * return true. Otherwise return false.
 * @returns {boolean}
 */
export function isCurrentUserExtern() {
	const hsUrl = MatrixClientPeg.get().getHomeserverUrl();
	return hsUrl.includes('.e.') || hsUrl.includes('.externe.');
}

/**
 * Given a user ID, return true if this user is from
 * an external Homeserver. Otherwise return false.
 * @param {string} userId The user ID to test for.
 * @returns {boolean}
 */
export function isUserExtern(userId) {
	return userId ? (
		userId.split(':')[1].startsWith('e.') ||
		userId.split(':')[1].startsWith('agent.externe.')
	) : false;
}
