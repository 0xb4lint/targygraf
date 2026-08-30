/*
 * One-time localStorage migration from the legacy {university}.targygraf.hu
 * origins onto targygraf.hu.
 *
 * Until 2026 the site lived on per-university subdomains and stored progress
 * under those origins. After the move to apex paths that localStorage would
 * be unreachable, so university and program pages embed a hidden iframe
 * pointing at https://{university}.targygraf.hu/__ls-migrate (a path the
 * redirect layer intentionally leaves alone). That page posts the stored
 * values back here and this script merges them into the apex origin's
 * localStorage, then reloads so the unmodified targygraf.js picks them up.
 *
 * The lsMigratedFrom_{university} flag makes this run once per subdomain:
 * it is set on a successful handoff, so a failed attempt (offline, or the
 * legacy origin not serving the page yet) retries on a later visit.
 */
(function () {
	'use strict';

	var university = window.lsMigrateUniversity;
	if (!university || window.top !== window) {
		return;
	}

	var FLAG_KEY = 'lsMigratedFrom_' + university;
	var SOURCE_ORIGIN = 'https://' + university + '.targygraf.hu';
	var ARRAY_KEYS = ['coursesFinished', 'coursesProcessing'];
	var MAX_ITEMS = 5000;

	try {
		if (window.localStorage.getItem(FLAG_KEY)) {
			return;
		}
	} catch (error) {
		return;
	}

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

	var frame = document.createElement('iframe');
	frame.style.display = 'none';
	frame.setAttribute('aria-hidden', 'true');
	frame.src = SOURCE_ORIGIN + '/__ls-migrate';

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
		if (!data || data.type !== 'targygraf-ls') {
			return;
		}

		var changed = false;
		try {
			for (var i = 0; i < ARRAY_KEYS.length; i++) {
				if (mergeArrayKey(ARRAY_KEYS[i], data[ARRAY_KEYS[i]])) {
					changed = true;
				}
			}
			if (mergeOptionalCredits(data.creditsOptional)) {
				changed = true;
			}
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
