/*
 * Tárgygráf frontend – dependency-free vanilla JS.
 * Szekeres Bálint - https://targygraf.hu - https://b4lint.hu
 *
 * The localStorage contract is frozen (users have kept their progress in it
 * since 2012) and must stay that way:
 *   coursesFinished   JSON array of course codes
 *   coursesProcessing JSON array of course codes
 *   creditsOptional   JSON number
 * Codes stored years ago may be numbers rather than strings, so all
 * comparisons go through String().
 *
 * Deliberately preserved quirks (they shape what users see restored):
 *   - restoring marks every element sharing a code, but counts the credits
 *     of the first one only; clicking affects just the clicked element
 *   - the "max credits" sum includes every course in the semester row,
 *     regardless of the block's data-is-counted flag
 *   - codes present in storage but not on the current page are kept and
 *     written back on save (progress from other curricula must survive)
 */
(function (Targygraf, window) {
	'use strict';

	var document = window.document;

	var timeoutProgressbar = null;

	var CREDITS = {
		finished: 0,
		processing: 0,
		optional: 0,
		overflow: 0
	};

	var COURSES = {
		finished: [],
		processing: []
	};

	//////////////
	// DOM UTIL //
	//////////////
	function all(selector, root) {
		return Array.prototype.slice.call((root || document).querySelectorAll(selector));
	}

	function courses() {
		return all('.course');
	}

	function coursesByCode(code) {
		var wanted = String(code);
		return courses().filter(function (el) {
			return (el.getAttribute('data-code') || '') === wanted;
		});
	}

	function courseById(id) {
		return courses().filter(function (el) {
			return el.getAttribute('data-id') === id;
		})[0] || null;
	}

	function sequelsOf(el) {
		var id = el.getAttribute('data-id');
		return courses().filter(function (other) {
			return (other.getAttribute('data-prerequisites') || '').indexOf(id) !== -1;
		});
	}

	function creditsOf(el) {
		return parseInt(el.getAttribute('data-credits'), 10) || 0;
	}

	function referencedBlocksAttr(el) {
		return el.getAttribute('data-referenced-course-blocks') || '';
	}

	function prerequisitesAttr(el) {
		return el.getAttribute('data-prerequisites') || '';
	}

	function specialisOf(el) {
		var content = el.closest('.content');
		return content ? parseInt(content.getAttribute('data-specialis'), 10) : 0;
	}

	function isInert(el) {
		return referencedBlocksAttr(el) !== '' || el.getAttribute('data-code') === '___OPTIONAL___';
	}

	function removeValue(array, code) {
		var wanted = String(code);
		for (var i = array.length - 1; i >= 0; i--) {
			if (String(array[i]) === wanted) {
				array.splice(i, 1);
			}
		}
	}

	//////////////////
	// LOCALSTORAGE //
	//////////////////
	function save(key, value) {
		window.localStorage.setItem(key, JSON.stringify(value));
	}

	function load(key) {
		try {
			return JSON.parse(window.localStorage.getItem(key));
		} catch (error) {
			return null;
		}
	}

	function remove(key) {
		window.localStorage.removeItem(key);
	}

	function loadDataFromLocalStorage() {
		var coursesFinished = load('coursesFinished');
		var coursesProcessing = load('coursesProcessing');
		var creditsOptional = load('creditsOptional');

		if (coursesFinished) {
			for (var i = 0; i < coursesFinished.length; i++) {
				var finishedEls = coursesByCode(coursesFinished[i]);

				if (finishedEls.length) {
					finishCourse(finishedEls, true, false, true, false);
				} else {
					COURSES.finished.push(coursesFinished[i]);
				}
			}
		}

		if (coursesProcessing) {
			for (var j = 0; j < coursesProcessing.length; j++) {
				var processingEls = coursesByCode(coursesProcessing[j]);

				if (processingEls.length) {
					processCourse(processingEls, true, true);
				} else {
					COURSES.processing.push(coursesProcessing[j]);
				}
			}
		}

		CREDITS.optional = typeof creditsOptional === 'number' ? creditsOptional : 0;

		markOptionalCourses();
	}

	function saveDataToLocalStorage() {
		save('coursesFinished', COURSES.finished);
		save('coursesProcessing', COURSES.processing);
		save('creditsOptional', CREDITS.optional);
	}

	////////////////////////////
	// INITIAL VIEW FUNCTIONS //
	////////////////////////////
	function setBodyMinWidth() {
		var semesterBlocks = all('.content[data-specialis="0"] .course-block').length;
		var specialBlocks = all('.content[data-specialis="1"] .course-block').length;

		// Pages without a graph (home, university) are responsive; only the
		// program pages need the fixed-width canvas.
		if (!(semesterBlocks + specialBlocks)) {
			return;
		}

		var sumWidth = Math.max(semesterBlocks, specialBlocks) * 146;

		var help = document.querySelector('main .help');
		if (help) {
			sumWidth += help.getBoundingClientRect().width * 2;
		}

		document.body.style.minWidth = sumWidth + 'px';
	}

	function setCourseBlocksTitleHeight() {
		window.setTimeout(function () {
			all('.content').forEach(function (content) {
				var maxTitleHeight = 0;
				var titles = all('.course-block > .course-block-title', content);

				titles.forEach(function (title) {
					maxTitleHeight = Math.max(
						maxTitleHeight,
						title.getBoundingClientRect().height + 2
					);
				});

				titles.forEach(function (title) {
					title.style.height = maxTitleHeight + 'px';
				});
			});
		}, 500);
	}

	function markCoursesWithoutSequel() {
		all('.content[data-specialis="0"] .course').forEach(function (el) {
			if (prerequisitesAttr(el) !== '' && !sequelsOf(el).length) {
				el.classList.add('end');
			}
		});
	}

	//////////////////
	// VIEW BUTTONS //
	//////////////////
	function enableReset() {
		var reset = document.querySelector('.buttons .reset');
		if (!reset) {
			return;
		}
		reset.style.display =
			COURSES.finished.length || COURSES.processing.length ? '' : 'none';
	}

	//////////////////
	// VIEW UPDATES //
	//////////////////
	function creditsCounterUpdate() {
		window.clearTimeout(timeoutProgressbar);

		var counterFinished = document.querySelector('.credits-counter .finished');
		var counterProcessing = document.querySelector('.credits-counter .processing');
		if (!counterFinished) {
			return;
		}

		counterFinished.innerHTML =
			'Teljesített: <b>' + (CREDITS.finished + CREDITS.optional) + ' kredit</b>';
		counterProcessing.innerHTML = 'Felvett: <b>' + CREDITS.processing + ' kredit</b>';

		timeoutProgressbar = window.setTimeout(function () {
			var progressbar = document.querySelector('.progressbar');
			var sumCredits = CREDITS.finished + CREDITS.processing + CREDITS.optional;
			var maxCredits = getMaxCredits();

			if (!maxCredits || !progressbar) {
				return;
			}

			var percentage = Math.round((sumCredits / maxCredits) * 1000) / 10;
			progressbar.setAttribute('title', percentage + ' %');

			var finished = progressbar.querySelector('.finished');
			var processing = progressbar.querySelector('.processing');

			finished.style.transition = 'width 0.4s';
			processing.style.transition = 'width 0.4s';
			finished.style.width =
				((CREDITS.finished + CREDITS.optional) / maxCredits) * 100 + '%';
			processing.style.width = (CREDITS.processing / maxCredits) * 100 + '%';
			finished.innerHTML = '<b>' + (CREDITS.finished + CREDITS.optional) + '</b> kredit';
			processing.innerHTML = '<b>' + CREDITS.processing + '</b> kredit';
		}, 250);
	}

	function creditsOverflowUpdate() {
		var overflow = document.querySelector('.credits-counter .credits-overflow');
		if (overflow) {
			overflow.innerHTML =
				CREDITS.overflow > 0 ? ' [+ ' + CREDITS.overflow + ' kredit]' : '';
		}
	}

	function markProcessableCourses() {
		courses().forEach(function (el) {
			el.classList.toggle('processable', isCourseProcessable(el));
		});
	}

	function markOptionalCourses() {
		var optionalCreditsSum = CREDITS.optional + CREDITS.overflow;

		all('.course[data-code="___OPTIONAL___"]')
			.sort(function (a, b) {
				return creditsOf(b) - creditsOf(a);
			})
			.forEach(function (el) {
				el.classList.remove('finished');

				var courseCredits = creditsOf(el);
				if (optionalCreditsSum >= courseCredits) {
					el.classList.add('finished');

					if (specialisOf(el) === 0) {
						optionalCreditsSum -= courseCredits;
					}
				}
			});

		var counter = document.querySelector('.credits-counter .credits-optional');
		if (counter) {
			counter.textContent = CREDITS.optional;
		}

		var minus = document.querySelector('.credits-counter .credits-optional-control.minus');
		if (minus) {
			minus.classList.toggle('muted', !CREDITS.optional);
		}
	}

	//////////////////////
	// COURSE FUNCTIONS //
	//////////////////////
	// The els argument is a single element (click) or every element sharing a
	// stored code (restore) -- credits/arrays use the first, classes hit all.
	function toArray(els) {
		return Array.isArray(els) ? els : [els];
	}

	function processCourse(els, incrementCreditsProcessing, addToProcessingArray) {
		els = toArray(els);
		var first = els[0];

		if (isInert(first)) {
			return;
		}

		if (incrementCreditsProcessing === undefined || incrementCreditsProcessing) {
			CREDITS.processing += creditsOf(first);
		}

		if (addToProcessingArray === undefined || addToProcessingArray) {
			COURSES.processing.push(first.getAttribute('data-code'));
		}

		els.forEach(function (el) {
			el.classList.remove('processable');
			el.classList.add('processing');
		});
	}

	function finishCourse(
		els,
		incrementCreditsFinished,
		decrementCreditsProcessing,
		addToDoneArray,
		removeFromProcessingArray
	) {
		els = toArray(els);
		var first = els[0];

		if (isInert(first)) {
			return;
		}

		var credits = creditsOf(first);

		if (incrementCreditsFinished === undefined || incrementCreditsFinished) {
			CREDITS.finished += credits;
		}

		if (decrementCreditsProcessing === undefined || decrementCreditsProcessing) {
			CREDITS.processing -= credits;
		}

		if (addToDoneArray === undefined || addToDoneArray) {
			COURSES.finished.push(first.getAttribute('data-code'));
		}

		if (removeFromProcessingArray === undefined || removeFromProcessingArray) {
			removeValue(COURSES.processing, first.getAttribute('data-code'));
		}

		els.forEach(function (el) {
			el.classList.remove('processing');
			el.classList.add('finished');
		});

		if (specialisOf(first) === 1) {
			markReferencedCourseBlocks();
			markOptionalCourses();
			creditsOverflowUpdate();
			creditsCounterUpdate();
		}
	}

	function removeCourse(el, decrementCreditsFinished, removeFromFinishedArray) {
		var conflictedProcessing = [];
		var conflictedFinished = [];

		sequelsOf(el).forEach(function (sequel) {
			if (sequel.classList.contains('processing')) {
				conflictedProcessing.push(sequel);
			}
			if (sequel.classList.contains('finished')) {
				conflictedFinished.push(sequel);
			}
		});

		var errorText = '';
		if (conflictedProcessing.length) {
			errorText += 'Kérlek távolítsd el a következő felvételeket:\n';
			conflictedProcessing.forEach(function (item) {
				errorText += '- ' + item.textContent.trim() + '\n';
			});
		}

		if (conflictedFinished.length) {
			errorText += 'Kérlek távolítsd el a következő teljesítéseket:\n';
			conflictedFinished.forEach(function (item) {
				errorText += '- ' + item.textContent.trim() + '\n';
			});
		}

		if (errorText.length) {
			return window.alert(errorText);
		}

		if (decrementCreditsFinished === undefined || decrementCreditsFinished) {
			CREDITS.finished -= creditsOf(el);
		}

		if (removeFromFinishedArray === undefined || removeFromFinishedArray) {
			removeValue(COURSES.finished, el.getAttribute('data-code'));
		}

		el.classList.remove('finished');
		el.classList.add('processable');

		if (specialisOf(el) === 1) {
			markReferencedCourseBlocks();
			markOptionalCourses();
			creditsOverflowUpdate();
			creditsCounterUpdate();
		}
	}

	function showCoursePrerequisites(el) {
		if (prerequisitesAttr(el) === '') {
			return;
		}

		prerequisitesAttr(el).split(',').forEach(function (token) {
			var id = token[0] === '#' ? token.substring(1) : token;
			var target = courseById(id);
			if (target) {
				target.classList.add('prerequisite');
			}
		});
	}

	function showCourseSequel(el) {
		sequelsOf(el).forEach(function (sequel) {
			sequel.classList.add('sequel');
		});
	}

	function blurCourses() {
		all('.course.sequel').forEach(function (el) {
			el.classList.remove('sequel');
		});
		all('.course.prerequisite').forEach(function (el) {
			el.classList.remove('prerequisite');
		});
	}

	////////////////////////////
	// COURSE BLOCK FUNCTIONS //
	////////////////////////////
	function courseBlockById(id) {
		return all('.course-block').filter(function (block) {
			return block.getAttribute('data-id') === id;
		})[0] || null;
	}

	function showCourseBlockReferences(el, show) {
		referencedBlocksAttr(el).split(',').forEach(function (id) {
			var block = courseBlockById(id);
			if (block) {
				block.style.zIndex = show ? '101' : '';
				block.style.backgroundColor = show ? 'white' : '';
			}
		});
	}

	function markReferencedCourseBlocks() {
		CREDITS.overflow = 0;

		// collect all referenced course block groups
		var groups = [];
		courses().forEach(function (el) {
			var attr = referencedBlocksAttr(el);
			if (attr !== '' && groups.indexOf(attr) === -1) {
				groups.push(attr);
			}
		});

		groups.forEach(function (group) {
			var maxCredits = 0;
			var sumFinishedCredits = 0;
			var blockIds = group.split(',');

			blockIds.forEach(function (blockId) {
				var block = courseBlockById(blockId);
				if (!block) {
					return;
				}
				block.classList.remove('finished');
				all('.course.finished', block).forEach(function (course) {
					sumFinishedCredits += creditsOf(course);
				});
			});

			var referencingCourses = courses().filter(function (el) {
				return referencedBlocksAttr(el) === group;
			});

			referencingCourses.forEach(function (el) {
				maxCredits += creditsOf(el);
			});

			if (sumFinishedCredits >= maxCredits) {
				CREDITS.overflow += sumFinishedCredits - maxCredits;
				blockIds.forEach(function (blockId) {
					var block = courseBlockById(blockId);
					if (block) {
						block.classList.add('finished');
					}
				});
			}

			referencingCourses
				.sort(function (a, b) {
					return creditsOf(b) - creditsOf(a);
				})
				.forEach(function (el) {
					el.classList.remove('finished');

					var courseCredits = creditsOf(el);
					if (sumFinishedCredits >= courseCredits) {
						el.classList.add('finished');
						sumFinishedCredits -= courseCredits;
					}
				});
		});
	}

	//////////////////////
	// HELPER FUNCTIONS //
	//////////////////////
	function getMaxCredits() {
		// Historical quirk kept for parity: data-is-counted lives on the
		// blocks, so this sums every course of the semester row.
		var sum = 0;

		all('.content[data-specialis="0"] .course').forEach(function (el) {
			if (el.getAttribute('data-is-counted') !== '0') {
				sum += creditsOf(el);
			}
		});

		return sum;
	}

	function isCourseProcessable(el) {
		if (
			isInert(el) ||
			el.classList.contains('processing') ||
			el.classList.contains('finished')
		) {
			return false;
		}

		if (prerequisitesAttr(el) === '') {
			return true;
		}

		var sumCredits = CREDITS.finished + CREDITS.optional + CREDITS.overflow;
		var tokens = prerequisitesAttr(el).split(',');
		var creditRegex = /^___(\d+)___$/;

		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i];
			var creditMatches = creditRegex.exec(token);

			if (creditMatches) {
				if (sumCredits < parseInt(creditMatches[1], 10)) {
					return false;
				}
			} else if (token[0] === '#') {
				var parallel = courseById(token.substring(1));
				if (
					!parallel ||
					(!parallel.classList.contains('processing') &&
						!parallel.classList.contains('finished'))
				) {
					return false;
				}
			} else {
				var target = courseById(token);
				if (!target || !target.classList.contains('finished')) {
					return false;
				}
			}
		}

		return true;
	}

	//////////////
	// TOOLTIPS //
	//////////////
	// Minimal tooltip renderer emitting tipsy-style DOM: same classes, same
	// positioning, so the untouched tipsy.css keeps working.
	var tipsyElement = null;

	function tipsyFixTitle(el) {
		if (el.getAttribute('title') || typeof el.getAttribute('original-title') !== 'string') {
			el.setAttribute('original-title', el.getAttribute('title') || '');
			el.removeAttribute('title');
		}
	}

	function tipsyHide() {
		if (tipsyElement && tipsyElement.parentNode) {
			tipsyElement.parentNode.removeChild(tipsyElement);
		}
		tipsyElement = null;
	}

	function tipsyShow(el, gravity, html) {
		tipsyFixTitle(el);

		var title = (el.getAttribute('original-title') || '').replace(/(^\s*|\s*$)/, '');
		if (!title) {
			return;
		}

		tipsyHide();

		var tip = document.createElement('div');
		tip.className = 'tipsy tipsy-' + gravity;
		tip.innerHTML =
			'<div class="tipsy-arrow tipsy-arrow-' + gravity.charAt(0) + '"></div>' +
			'<div class="tipsy-inner"></div>';
		var inner = tip.querySelector('.tipsy-inner');
		if (html) {
			inner.innerHTML = title;
		} else {
			inner.textContent = title;
		}

		tip.style.top = '0';
		tip.style.left = '0';
		tip.style.visibility = 'hidden';
		tip.style.display = 'block';
		document.body.insertBefore(tip, document.body.firstChild);

		var rect = el.getBoundingClientRect();
		var pos = {
			top: rect.top + window.pageYOffset,
			left: rect.left + window.pageXOffset,
			width: el.offsetWidth,
			height: el.offsetHeight
		};
		var actualWidth = tip.offsetWidth;
		var actualHeight = tip.offsetHeight;

		var top;
		var left;
		switch (gravity.charAt(0)) {
			case 'n':
				top = pos.top + pos.height;
				left = pos.left + pos.width / 2 - actualWidth / 2;
				break;
			case 's':
				top = pos.top - actualHeight;
				left = pos.left + pos.width / 2 - actualWidth / 2;
				break;
			case 'e':
				top = pos.top + pos.height / 2 - actualHeight / 2;
				left = pos.left - actualWidth;
				break;
			case 'w':
				top = pos.top + pos.height / 2 - actualHeight / 2;
				left = pos.left + pos.width;
				break;
		}

		tip.style.top = top + 'px';
		tip.style.left = left + 'px';
		tip.style.visibility = 'visible';
		tip.style.opacity = '0.8';

		tipsyElement = tip;
	}

	function tipsy(els, gravity, html) {
		els.forEach(function (el) {
			tipsyFixTitle(el);
			el.addEventListener('mouseenter', function () {
				tipsyShow(el, gravity, html);
			});
			el.addEventListener('mouseleave', tipsyHide);
		});
	}

	function registerTooltips() {
		tipsy(all('.buttons .button'), 'e', false);
		tipsy(all('.course-help'), 'w', true);

		// iframes only ever needed their native tooltip suppressed
		all('iframe[title]').forEach(function (el) {
			el.removeAttribute('title');
		});

		tipsy(all('[title]'), 's', true);
	}

	///////////////
	// ANALYTICS //
	///////////////
	// Debounced per course like the original ga() events; GA4 via gtag with
	// the UA-compatible category/label mapping so historical reports line up.
	var analyticsTimers = {};

	function trackCourseEvent(el, action) {
		var id = el.getAttribute('data-id');
		var label = el.textContent.trim();

		if (analyticsTimers[id] !== undefined) {
			window.clearTimeout(analyticsTimers[id]);
		}

		analyticsTimers[id] = window.setTimeout(function () {
			if (typeof window.gtag === 'function') {
				window.gtag('event', action, {
					event_category: 'Tantárgy',
					event_label: label
				});
			}
		}, 1500);
	}

	////////////
	// EVENTS //
	////////////
	function registerEvents() {
		courses().forEach(function (el) {
			el.addEventListener('click', function () {
				if (isInert(el)) {
					return;
				}

				if (el.classList.contains('finished')) {
					removeCourse(el);
					trackCourseEvent(el, 'Leadás');
				} else if (el.classList.contains('processing')) {
					finishCourse(el);
					trackCourseEvent(el, 'Teljesítés');
				} else if (isCourseProcessable(el)) {
					processCourse(el);
					trackCourseEvent(el, 'Felvétel');
				}

				markProcessableCourses();
				enableReset();
				creditsCounterUpdate();
				saveDataToLocalStorage();
			});

			el.addEventListener('mouseenter', function () {
				showCourseSequel(el);
				showCoursePrerequisites(el);
			});
			el.addEventListener('mouseleave', blurCourses);
		});

		var fade = document.querySelector('.fade');

		courses().forEach(function (el) {
			if (referencedBlocksAttr(el) === '') {
				return;
			}
			el.addEventListener('mouseenter', function () {
				el.style.zIndex = '101';
				if (fade) {
					fade.style.display = 'block';
				}
				showCourseBlockReferences(el, true);
			});
			el.addEventListener('mouseleave', function () {
				showCourseBlockReferences(el, false);
				if (fade) {
					fade.style.display = '';
				}
				el.style.zIndex = '';
			});
		});

		all('.course[data-code="___OPTIONAL___"]').forEach(function (el) {
			var container = document.querySelector(
				'.credits-counter .credits-optional-container'
			);
			el.addEventListener('mouseenter', function () {
				el.style.zIndex = '101';
				if (fade) {
					fade.style.display = 'block';
				}
				if (container) {
					container.style.zIndex = '101';
					container.style.backgroundColor = 'white';
				}
			});
			el.addEventListener('mouseleave', function () {
				if (container) {
					container.style.zIndex = '';
					container.style.backgroundColor = '';
				}
				if (fade) {
					fade.style.display = '';
				}
				el.style.zIndex = '';
			});
		});

		var minus = document.querySelector('.credits-counter .credits-optional-control.minus');
		if (minus) {
			minus.addEventListener('click', function () {
				if (minus.classList.contains('muted')) {
					return;
				}
				CREDITS.optional--;
				markOptionalCourses();
				creditsCounterUpdate();
				saveDataToLocalStorage();
			});
		}

		var plus = document.querySelector('.credits-counter .credits-optional-control.plus');
		if (plus) {
			plus.addEventListener('click', function () {
				CREDITS.optional++;
				markOptionalCourses();
				creditsCounterUpdate();
				saveDataToLocalStorage();
			});
		}

		var toggle = document.querySelector('.program-selector .toggle');
		if (toggle) {
			toggle.addEventListener('click', function () {
				var faculties = document.querySelector('.program-selector .faculties');
				if (!faculties) {
					return;
				}
				var isOpen = faculties.style.display !== 'none';
				faculties.style.display = isOpen ? 'none' : '';
				toggle.classList.toggle('open', !isOpen);
			});
		}

		var reset = document.querySelector('.buttons .reset');
		if (reset) {
			reset.addEventListener('click', function () {
				if (!window.confirm('Biztos vagy benne?')) {
					return;
				}

				remove('coursesFinished');
				remove('coursesProcessing');
				remove('creditsOptional');

				window.location.reload();
			});
		}

		registerTooltips();
	}

	function showLegal() {
		var notice = document.createElement('div');
		notice.className = 'site-notice';
		notice.setAttribute('role', 'status');
		notice.textContent =
			'Tájékoztató jellegű oldal: a hivatalos tantervet az egyetemednél ellenőrizd.';

		function dismiss() {
			notice.classList.remove('visible');
			window.setTimeout(function () {
				if (notice.parentNode) {
					notice.parentNode.removeChild(notice);
				}
			}, 400);
		}

		notice.addEventListener('click', dismiss);
		document.body.appendChild(notice);
		window.setTimeout(function () {
			notice.classList.add('visible');
		}, 50);
		window.setTimeout(dismiss, 6000);
	}

	//////////
	// INIT //
	//////////
	Targygraf.init = function () {
		window.console.log('Szekeres Bálint - https://targygraf.hu - https://b4lint.hu');

		setBodyMinWidth();
		setCourseBlocksTitleHeight();
		markCoursesWithoutSequel();

		loadDataFromLocalStorage();
		markProcessableCourses();

		enableReset();

		creditsCounterUpdate();
		registerEvents();

		showLegal();
	};
})((window.Targygraf = window.Targygraf || {}), window);

if (window.document.readyState === 'loading') {
	window.document.addEventListener('DOMContentLoaded', function () {
		window.Targygraf.init();
	});
} else {
	window.Targygraf.init();
}
