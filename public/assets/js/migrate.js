/*
 * One-time localStorage migration from the legacy {university}.targygraf.hu
 * origins onto targygraf.hu.
 *
 * Until 2026 the site lived on per-university subdomains and stored progress
 * under those origins. After the move to apex paths that localStorage would
 * be unreachable, so university and program pages carry it over, once per
 * subdomain, tracked by the migrated_{university} flag (set on a successful
 * handoff only, so a failed attempt retries on a later visit).
 *
 * Two transports, because WebKit partitions iframe storage by the compound
 * of (top-level site, iframe origin), even for same-site subdomains:
 *
 * - Chrome/Firefox: a hidden iframe to {university}.targygraf.hu/__migrate
 *   posts the stored values back (silent; the redirect layer intentionally
 *   leaves that path alone).
 * - Safari and every iOS browser (Apple vendor = WebKit): a one-time
 *   top-level bounce to the same /__migrate page, which reads the storage
 *   first-party and returns it in a #tgm= URL fragment. The fragment is
 *   only accepted when the same-session bounce guard is set, so a crafted
 *   link cannot inject data.
 *
 * Either way the values are merged here and the page reloads so the
 * unmodified targygraf.js picks them up.
 */
(function () {
	'use strict';

	var university = window.migrateUniversity;
	if (!university || window.top !== window) {
		return;
	}

	var FLAG_KEY = 'migrated_' + university;
	var LEGACY_FLAG_KEY = 'migratedFrom_' + university;
	var GUARD_KEY = 'tgmBounced_' + university;
	var SOURCE_ORIGIN = 'https://' + university + '.targygraf.hu';
	var ARRAY_KEYS = ['coursesFinished', 'coursesProcessing'];
	var MAX_ITEMS = 5000;
	// Apple vendor = WebKit engine, including every iOS browser shell.
	var isWebKitPartitioned = window.navigator.vendor === 'Apple Computer, Inc.';

	function isCode(value) {
		return (
			(typeof value === 'string' && value.length > 0 && value.length < 100) ||
			(typeof value === 'number' && isFinite(value))
		);
	}

	// Returns true when the merge added anything new.
	function mergeArrayKey(key, incoming) {
		if (!Array.isArray(incoming)) {
			return false;
		}

		var existing;
		try {
			existing = JSON.parse(window.localStorage.getItem(key));
		} catch (error) {
			existing = null;
		}
		if (!Array.isArray(existing)) {
			existing = [];
		}

		var changed = false;
		for (var i = 0; i < incoming.length && existing.length < MAX_ITEMS; i++) {
			if (isCode(incoming[i]) && existing.indexOf(incoming[i]) === -1) {
				existing.push(incoming[i]);
				changed = true;
			}
		}

		if (changed) {
			window.localStorage.setItem(key, JSON.stringify(existing));
		}
		return changed;
	}

	// The apex value wins; the legacy value only fills an empty slot.
	function mergeOptionalCredits(incoming) {
		if (typeof incoming !== 'number' || !isFinite(incoming) || incoming <= 0) {
			return false;
		}
		if (window.localStorage.getItem('creditsOptional') !== null) {
			return false;
		}
		window.localStorage.setItem('creditsOptional', JSON.stringify(incoming));
		return true;
	}

	// Merges a handoff payload; returns whether anything new was stored.
	function importPayload(data) {
		var changed = false;
		for (var i = 0; i < ARRAY_KEYS.length; i++) {
			if (data && mergeArrayKey(ARRAY_KEYS[i], data[ARRAY_KEYS[i]])) {
				changed = true;
			}
		}
		if (data && mergeOptionalCredits(data.creditsOptional)) {
			changed = true;
		}
		return changed;
	}

	function sessionGet(key) {
		try {
			return window.sessionStorage.getItem(key);
		} catch (error) {
			return null;
		}
	}

	function sessionSet(key, value) {
		try {
			if (value === null) {
				window.sessionStorage.removeItem(key);
			} else {
				window.sessionStorage.setItem(key, value);
			}
		} catch (error) {
			// Session storage unavailable: the bounce loses its loop guard,
			// so skip bouncing entirely in that case (handled by the caller).
		}
	}

	// ------------------------------------------------------------------
	// 1. Returning from a top-level bounce: import the #tgm= fragment.
	// ------------------------------------------------------------------
	var fragment = /^#tgm=(.*)$/.exec(window.location.hash);
	if (fragment) {
		var guarded = sessionGet(GUARD_KEY) === '1';
		sessionSet(GUARD_KEY, null);
		window.history.replaceState(
			null,
			'',
			window.location.pathname + window.location.search
		);

		// Only accept a fragment we asked for in this session; a crafted
		// link must not be able to write into storage.
		if (!guarded) {
			return;
		}

		var payload = null;
		if (fragment[1] !== '0') {
			try {
				payload = JSON.parse(decodeURIComponent(fragment[1]));
			} catch (error) {
				return; // damaged payload: keep the flag unset, retry later
			}
		}

		try {
			var imported = importPayload(payload);
			window.localStorage.setItem(FLAG_KEY, '1');
			window.localStorage.removeItem(LEGACY_FLAG_KEY);
			if (imported) {
				window.location.reload();
			}
		} catch (error) {
			// Storage unavailable: leave the flag unset so a later visit retries.
		}
		return;
	}

	try {
		if (window.localStorage.getItem(FLAG_KEY)) {
			return;
		}
		// Flags set by the first release's iframe transport: trustworthy
		// everywhere except WebKit, where the iframe read an empty partition.
		if (window.localStorage.getItem(LEGACY_FLAG_KEY)) {
			window.localStorage.removeItem(LEGACY_FLAG_KEY);
			if (!isWebKitPartitioned) {
				window.localStorage.setItem(FLAG_KEY, '1');
				return;
			}
		}
	} catch (error) {
		return;
	}

	// ------------------------------------------------------------------
	// 2. WebKit: one top-level bounce per session through the legacy origin.
	// ------------------------------------------------------------------
	if (isWebKitPartitioned) {
		if (sessionGet(GUARD_KEY) === '1') {
			return; // already tried this session; retry next session
		}
		sessionSet(GUARD_KEY, '1');
		if (sessionGet(GUARD_KEY) !== '1') {
			return; // no session storage, no safe way to bounce
		}
		window.location.replace(
			SOURCE_ORIGIN + '/__migrate?return=' + encodeURIComponent(window.location.pathname)
		);
		return;
	}

	// ------------------------------------------------------------------
	// 3. Everyone else: silent same-site iframe handoff.
	// ------------------------------------------------------------------
	var frame = document.createElement('iframe');
	frame.style.display = 'none';
	frame.setAttribute('aria-hidden', 'true');
	frame.src = SOURCE_ORIGIN + '/__migrate';

	function cleanup() {
		if (frame.parentNode) {
			frame.parentNode.removeChild(frame);
		}
	}

	window.addEventListener('message', function (event) {
		if (event.origin !== SOURCE_ORIGIN) {
			return;
		}
		var data = event.data;
		if (!data || data.type !== 'targygraf-migrate') {
			return;
		}

		var changed = false;
		try {
			changed = importPayload(data);
			window.localStorage.setItem(FLAG_KEY, '1');
		} catch (error) {
			// Storage unavailable: leave the flag unset so a later visit retries.
		}

		cleanup();
		if (changed) {
			window.location.reload();
		}
	});

	document.body.appendChild(frame);
})();
