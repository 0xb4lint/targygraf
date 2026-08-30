/*globals window:false */
/*globals document:false */

Array.prototype.remove = function() {
	var what, a = arguments, L = a.length, ax;
	while (L && this.length) {
		what = a[--L];
		while ((ax = this.indexOf(what)) !== -1)
			this.splice(ax, 1);
	}
	return this;
};



(function(Targygraf, $, window) {
	'use strict';

	///////////////////////
	// PRIVATE VARIABLES //
	///////////////////////
	var timeoutProgressbar = null;

	var SNAPSHOT = {
		enabled:			window.snapshotMode || false,
		coursesFinished:	window.snapshotCoursesFinished,
		coursesProcessing:	window.snapshotCoursesProcessing,
		creditsOptional:	window.snapshotCreditsOptional
	};

	var CREDITS = {
		finished:	0,
		processing:	0,
		optional:	0,
		overflow:	0
	};

	var COURSES = {
		finished:	[],
		processing:	[]
	}







	//////////////////
	// LOCALSTORAGE //
	//////////////////
	function save( key, val ) {

		window.localStorage.setItem( key, JSON.stringify( val ) );
	}



	function load( key ) {

		return JSON.parse( window.localStorage.getItem( key ) );
	}



	function remove( key ) {

		window.localStorage.removeItem( key );
	}



	function loadDataFromLocalStorage() {

		var coursesFinished		= SNAPSHOT.enabled ? SNAPSHOT.coursesFinished : load('coursesFinished');
		var coursesProcessing	= SNAPSHOT.enabled ? SNAPSHOT.coursesProcessing : load('coursesProcessing');
		var creditsOptional		= SNAPSHOT.enabled ? SNAPSHOT.creditsOptional : load('creditsOptional');

		if (coursesFinished) {

			for (var i = 0; i < coursesFinished.length; i++) {

				var $courseFinished = $('.course[data-code="' + coursesFinished[i] + '"]');

				if ($courseFinished.length)
					finishCourse($courseFinished, true, false, true, false);
				else
					COURSES.finished.push( coursesFinished[i] );
			}
		}

		if (coursesProcessing) {

			for (var j = 0; j < coursesProcessing.length; j++) {

				var $courseProcessing = $('.course[data-code="' + coursesProcessing[j] + '"]');

				if ($courseProcessing.length)
					processCourse($courseProcessing, true, true);
				else
					COURSES.processing.push( coursesProcessing[j] );
			}
		}

		if (creditsOptional)
			CREDITS.optional = creditsOptional;
		else
			CREDITS.optional = 0;


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

		var sumWidth = 960;

		var courseBlocksSemester = $('.content[data-specialis="0"] .course-block').length;
		var courseBlocksNotSemester = $('.content[data-specialis="1"] .course-block').length;

		if (courseBlocksSemester + courseBlocksNotSemester)
			sumWidth = Math.max(courseBlocksSemester, courseBlocksNotSemester) * 146;

		if ($('main .help').length)
			sumWidth += $('main .help').width() * 2;

		$('body').css('min-width', sumWidth + 'px');
	}



	function setCourseBlocksTitleHeight() {

		window.setTimeout(function() {

			$('.content').each(function() {

				var maxCourseBlockTitleHeight = 0;

				$(this).children('.course-block').each(function() {

					var courseBlockTitleHeight = $(this).children('.course-block-title').height() + 2;

					maxCourseBlockTitleHeight = Math.max(maxCourseBlockTitleHeight, courseBlockTitleHeight);
				});

				$(this).find('.course-block-title').height(maxCourseBlockTitleHeight);
			});

		}, 500);
	}



	function markCoursesWithoutSequel() {

		$('.content[data-specialis="0"] .course[data-prerequisites!=""]').each(function() {

			var sequels = $('.course[data-prerequisites*="' + $(this).data('id') + '"]').length;

			if (!sequels)
				$(this).addClass('end');
		});
	}





	//////////////////
	// VIEW BUTTONS //
	//////////////////
	function enableShare() {

		if (SNAPSHOT.enabled)
			return $('#share').hide();

		if (COURSES.finished.length || COURSES.processing.length)
			$('#share').show();
		else
			$('#share').hide();
	}



	function enableReset() {

		if (SNAPSHOT.enabled)
			return $('#reset').hide();

		if (COURSES.finished.length || COURSES.processing.length)
			$('#reset').show();
		else
			$('#reset').hide();
	}





	//////////////////
	// VIEW UPDATES //
	//////////////////
	function creditsCounterUpdate() {

		window.clearTimeout(timeoutProgressbar);

		$('.credits-counter .finished').html('Teljesített: <b>' + (CREDITS.finished + CREDITS.optional) + ' kredit</b>');
		$('.credits-counter .processing').html('Felvett: <b>' + CREDITS.processing + ' kredit</b>');

		timeoutProgressbar = window.setTimeout(function() {

			var progressbarWidth = $('.progressbar').width();

			var sumCredits = CREDITS.finished + CREDITS.processing + CREDITS.optional;
			var maxCredits = getMaxCredits();

			if (!maxCredits)
				return;

			var percentage = Math.round((sumCredits / maxCredits) * 1000) / 10;
			$('.progressbar').attr('title', percentage + " %");

			var finishedWidth = ((CREDITS.finished + CREDITS.optional) / maxCredits) * progressbarWidth;
			var processingWidth = (CREDITS.processing / maxCredits) * progressbarWidth;

			$('.progressbar .finished').stop(true, true)
				.animate({width: finishedWidth}, 400)
				.html('<b>' + (CREDITS.finished + CREDITS.optional) + '</b> kredit');

			$('.progressbar .processing').stop(true, true)
				.animate({width: processingWidth}, 400)
				.html('<b>' + CREDITS.processing + '</b> kredit');

		}, 250);
	}



	function creditsOverflowUpdate() {

		if (CREDITS.overflow > 0)
			$('.credits-counter .credits-overflow').html(' [+ ' + CREDITS.overflow + ' kredit]');
		else
			$('.credits-counter .credits-overflow').html('');
	}



	function markProcessableCourses() {

		$('.course').each(function() {

			var $course = $(this);

			if (isCourseProcessable( $course ))
				$course.addClass('processable');
			else
				$course.removeClass('processable');
		});
	}



	function markOptionalCourses() {

		var optionalCreditsSum = CREDITS.optional + CREDITS.overflow;

		$('.course[data-code="___OPTIONAL___"]').sort(function(a, b) {
			return parseInt( $(a).data('credits') ) < parseInt( $(b).data('credits') );
		}).each(function() {

			$(this).removeClass('finished');

			var courseCredits = parseInt( $(this).data('credits') );
			if (optionalCreditsSum >= courseCredits) {

				$(this).addClass('finished');

				if (parseInt( $(this).parents('.content').data('specialis') ) === 0)
					optionalCreditsSum -= courseCredits;
			}
		});

		$('.credits-counter .credits-optional').text(CREDITS.optional);

		if (!CREDITS.optional)
			$('.credits-counter .credits-optional-control.minus').addClass('muted');
		else
			$('.credits-counter .credits-optional-control.minus').removeClass('muted');
	}





	//////////////////////
	// COURSE FUNCTIONS //
	//////////////////////
	function processCourse(
		$course,
		incrementCreditsProcessing,
		addToProcessingArray
	) {
		if ($course.data('referenced-course-blocks') !== '' || $course.data('code') === '___OPTIONAL___')
			return;

		var credits = parseInt( $course.data('credits') );

		if (incrementCreditsProcessing === undefined || incrementCreditsProcessing)
			CREDITS.processing += credits;

		if (addToProcessingArray === undefined || addToProcessingArray)
			COURSES.processing.push( $course.data('code') );

		$course.removeClass('processable').addClass('processing');
	}



	function finishCourse(
		$course,
		incrementCreditsFinished,
		decrementCreditsProcessing,
		addToDoneArray,
		removeFromProcessingArray
	) {
		if (
			$course.data('referenced-course-blocks') !== '' ||
			$course.data('code') === '___OPTIONAL___'
		) {
			return;
		}

		var credits = parseInt( $course.data('credits') );

		if (incrementCreditsFinished === undefined || incrementCreditsFinished)
			CREDITS.finished += credits;

		if (decrementCreditsProcessing === undefined || decrementCreditsProcessing)
			CREDITS.processing -= credits;

		if (addToDoneArray === undefined || addToDoneArray)
			COURSES.finished.push( $course.data('code') );

		if (removeFromProcessingArray === undefined || removeFromProcessingArray)
			COURSES.processing.remove( $course.data('code') );

		$course.removeClass('processing').addClass('finished');

		if (parseInt( $course.parents('.content').data('specialis') ) === 1) {
			markReferencedCourseBlocks();
			markOptionalCourses();
			creditsOverflowUpdate();
			creditsCounterUpdate();
		}
	}



	function removeCourse(
		$course,
		decrementCreditsFinished,
		removeFromFinishedArray
	) {

		var $sequels = $('.course[data-prerequisites*="' + $course.data('id') + '"]');

		var conflictedProcessing	= [];
		var conflictedFinished		= [];

		if ($sequels.length) {
			$sequels.each(function() {

				var $course = $(this);

				if ($course.hasClass('processing'))
					conflictedProcessing.push( $course );

				if ($course.hasClass('finished'))
					conflictedFinished.push( $course );
			});
		}



		var errorText = '';
		if (conflictedProcessing.length) {

			errorText += 'Kérlek távolítsd el a következő felvételeket:\n';

			for (var i = 0; i < conflictedProcessing.length; i++)
				errorText += '- ' + conflictedProcessing[i].text().trim() + '\n';
		}

		if (conflictedFinished.length) {

			errorText += 'Kérlek távolítsd el a következő teljesítéseket:\n';

			for (var j = 0; j < conflictedFinished.length; j++)
				errorText += '- ' + conflictedFinished[j].text().trim() + '\n';
		}

		if (errorText.length)
			return alert(errorText);



		var credits = parseInt( $course.data('credits') );

		if (decrementCreditsFinished === undefined || decrementCreditsFinished)
			CREDITS.finished -= credits;

		if (removeFromFinishedArray === undefined || removeFromFinishedArray)
			COURSES.finished.remove( $course.data('code') );

		$course.removeClass('finished').addClass('processable');

		if (parseInt( $course.parents('.content').data('specialis') ) === 1) {
			markReferencedCourseBlocks();
			markOptionalCourses();
			creditsOverflowUpdate();
			creditsCounterUpdate();
		}
	}



	function showCoursePrerequisites($course) {

		if ($course.data('prerequisites') === '')
			return;

		var prerequisites = $course.data('prerequisites').split(',');

		for (var i = 0; i < prerequisites.length; i++) {

			var prerequisite = prerequisites[i];

			if (prerequisite[0] == '#')
				prerequisite = prerequisite.substring(1);

			$('.course[data-id="' + prerequisite + '"]').addClass('prerequisite');
		}
	}



	function showCourseSequel($course) {

		$('.course[data-prerequisites*="' + $course.data('id') + '"]').addClass('sequel');
	}



	function blurCourses() {

		$('.course.sequel').removeClass('sequel');
		$('.course.prerequisite').removeClass('prerequisite');
	}





	////////////////////////////
	// COURSE BLOCK FUNCTIONS //
	////////////////////////////
	function showCourseBlockReferences($course, show) {

		var referencedCourseBlocks = $course.data('referenced-course-blocks').split(',');

		for (var i = 0; i < referencedCourseBlocks.length; i++) {

			$('.course-block[data-id="' + referencedCourseBlocks[i] + '"]')
				.css('z-index', show ? '101' : '')
				.css('background-color', show ? 'white' : '');
		}
	}



	function markReferencedCourseBlocks() {

		CREDITS.overflow = 0;

		// collect all referenced course blocks
		var referencedCourseBlocks = [];
		$('.course[data-referenced-course-blocks!=""]').each(function() {

			var courseReferencedCourseBlocks = $(this).data('referenced-course-blocks');

			if (referencedCourseBlocks.indexOf(courseReferencedCourseBlocks) === -1)
				referencedCourseBlocks.push(courseReferencedCourseBlocks);
		});

		// process blocks
		for (var i = 0; i < referencedCourseBlocks.length; i++) {

			var maxCredits			= 0;
			var sumFinishedCredits	= 0;
			var courseBlocks		= referencedCourseBlocks[i].split(',');

			for (var j = 0; j < courseBlocks.length; j++) {

				// remove finished class from block
				$('.course-block[data-id="' + courseBlocks[j] + '"]').removeClass('finished');

				// sum block finished course credits
				$('.course-block[data-id="' + courseBlocks[j] + '"] .course.finished').each(function() {
					sumFinishedCredits += parseInt( $(this).data('credits') );
				})
			}

			// courses references to this block
			var $coursesReferencesThisBlock = $('.course[data-referenced-course-blocks="' + referencedCourseBlocks[i] + '"]');

			// sum referenced courses credits
			$coursesReferencesThisBlock.each(function() {
				maxCredits += parseInt( $(this).data('credits') );
			});

			// add finished class to block, overflow handing
			if (sumFinishedCredits >= maxCredits) {

				CREDITS.overflow += sumFinishedCredits - maxCredits;

				for (var k = 0; k < courseBlocks.length; k++)
					$('.course-block[data-id="' + courseBlocks[k] + '"]').addClass('finished');
			}

			// sort courses references to this block by credits
			$coursesReferencesThisBlock.sort(function(a, b) {
				return parseInt( $(a).data('credits') ) < parseInt( $(b).data('credits') );
			}).each(function() {

				// remove finished class
				$(this).removeClass('finished');

				// add finished class
				var courseCredits = parseInt( $(this).data('credits') );
				if (sumFinishedCredits >= courseCredits) {

					$(this).addClass('finished');
					sumFinishedCredits -= courseCredits;
				}
			});
		}
	}





	//////////////////////
	// HELPER FUNCTIONS //
	//////////////////////
	function getMaxCredits() {

		var sum = 0;

		$('.content[data-specialis="0"] .course[data-is-counted!="0"]').each(function() {
			sum += parseInt( $(this).data('credits') );
		});

		return sum;
	}



	function isCourseProcessable($course) {

		if (
			$course.data('referenced-course-blocks') !== '' ||
			$course.data('code') == '___OPTIONAL___' ||
			$course.hasClass('processing') ||
			$course.hasClass('finished')
		) {
			return false;
		}

		if ($course.data('prerequisites') === '')
			return true;


		var sumCredits		= CREDITS.finished + CREDITS.optional + CREDITS.overflow;
		var prerequisites	= $course.data('prerequisites').split(',');
		var creditRegex		= /^___(\d+)___$/;

		for (var i = 0; i < prerequisites.length; i++) {

			var prerequisite		= prerequisites[i];
			var creditRegexMatches	= creditRegex.exec( prerequisite );

			if (creditRegexMatches) {

				if (sumCredits < parseInt( creditRegexMatches[1] ))
					return false;

			} else if (prerequisite[0] === '#') {

				if (
					!$('.course[data-id="' + prerequisite.substring(1) + '"]').hasClass('processing') &&
					!$('.course[data-id="' + prerequisite.substring(1) + '"]').hasClass('finished')
				) {
					return false;
				}

			} else {

				if (!$('.course[data-id="' + prerequisite + '"]').hasClass('finished'))
					return false;

			}
		}

		return true;
	}





	////////////
	// EVENTS //
	////////////
	function registerEvents() {

		var courseGAEvents = {};

		$('.course').click(function() {

			if (SNAPSHOT.enabled)
				return;

			var $course	= $(this);
			var id		= $course.data('id');
			var text	= $course.text().trim();

			if (
				$course.data('referenced-course-blocks') !== '' ||
				$course.data('code') === '___OPTIONAL___'
			) {
				return;
			}

			if ($course.hasClass('finished')) {

				removeCourse($course);

				if (courseGAEvents[ id ] !== undefined)
					window.clearTimeout( courseGAEvents[ id ] );

				courseGAEvents[ id ] = window.setTimeout(function() {
					window.ga('send', 'event', 'Tantárgy', 'Leadás', text)
				}, 1500);

			} else if ($course.hasClass('processing')) {

				finishCourse($course);

				if (courseGAEvents[ id ] !== undefined)
					window.clearTimeout( courseGAEvents[ id ] );

				courseGAEvents[ id ] = window.setTimeout(function() {
					window.ga('send', 'event', 'Tantárgy', 'Teljesítés', text);
				}, 1500);

			} else if (isCourseProcessable( $course )) {

				processCourse($course);

				if (courseGAEvents[ id ] !== undefined)
					window.clearTimeout( courseGAEvents[ id ] );

				courseGAEvents[ id ] = window.setTimeout(function() {
					window.ga('send', 'event', 'Tantárgy', 'Felvétel', text)
				}, 1500);
			}

			markProcessableCourses();
			enableShare();
			enableReset();
			creditsCounterUpdate();
			saveDataToLocalStorage();
		});



		$('.course').hover(
		function() {
			showCourseSequel($(this));
			showCoursePrerequisites($(this));
		},
		function() {
			blurCourses();
		});



		$('.course[data-referenced-course-blocks!=""]').hover(
		function() {
			$(this).css('z-index', '101');
			$('.fade').show();

			showCourseBlockReferences($(this), true);

		}, function() {

			showCourseBlockReferences($(this), false);

			$('.fade').hide();
			$(this).css('z-index', '');
		});



		$('.course[data-code="___OPTIONAL___"]').hover(
		function() {

			$(this).css('z-index', '101');
			$('.fade').show();
			$('.credits-counter  .credits-optional-container').css('z-index', '101').css('background-color', 'white');

		}, function() {

			$('.credits-counter  .credits-optional-container').css('z-index', '').css('background-color', '');
			$('.fade').hide();
			$(this).css('z-index', '');
		});



		$('.credits-counter .credits-optional-control.minus').click(function() {

			if (SNAPSHOT.enabled || $(this).hasClass('muted'))
				return;

			CREDITS.optional--;
			markOptionalCourses();
			creditsCounterUpdate();
			saveDataToLocalStorage();
		});



		$('.credits-counter .credits-optional-control.plus').click(function() {

			if (SNAPSHOT.enabled)
				return;

			CREDITS.optional++;
			markOptionalCourses();
			creditsCounterUpdate();
			saveDataToLocalStorage();
		});



		$('.program-selector .toggle').click(function() {
			$(this).hide();
			$('.program-selector .faculties').show();
		})



		$('.buttons .reset').click(function() {

			if (!confirm('Biztos vagy benne?'))
				return;

			remove('coursesFinished');
			remove('coursesProcessing');
			remove('creditsOptional');

			location.reload();
		});



		/*$('#share').click(function() {

			if ($(this).hasClass('loading'))
				return;

			var url		= $(this).data('url');
			var szak	= $(this).data('szak');
			var html	= $(this).html();
			var save	= this;

			$(this).addClass('loading');
			$(this).html('<i class="fa fa-fw fa-circle-o-notch fa-spin"></i>');

			$.post( url, {
				szak:			szak,
				teljesitett:	JSON.stringify( COURSES.finished ),
				felvett:		JSON.stringify( COURSES.processing ),
				szabad:			CREDITS.optional
			}, function (data) {

				$(save).hide();
				window.location = data.link;

			}, 'json').always(function() {

				$(save).html( html );
				$(save).removeClass('loading');
			});
		});*/

		$('.buttons .button').tipsy({
			gravity: 'e'
		});

		$('.course-help').tipsy({
			gravity: 'w',
			html: true
		});

		$('iframe[title]').tipsy({
			opacity: 0
		});

		$('[title]').tipsy({
			gravity: 's',
			html: true
		});
	}



	function showLegal() {
		notie.alert({
			type: 'error',
			text: 'Az oldalon található információk nem tekinthetőek hivatalos forrásnak.',
			position: 'bottom'
		});
	}




	//////////
	// INIT //
	//////////
	Targygraf.init = function() {

		window.console.log('Szekeres Bálint - https://targygraf.hu - https://balint.szekeres.me');

		setBodyMinWidth();
		setCourseBlocksTitleHeight();
		markCoursesWithoutSequel();

		loadDataFromLocalStorage();
		markProcessableCourses();

		enableShare();
		enableReset();

		creditsCounterUpdate();
		registerEvents();

		showLegal();
	};

}(window.Targygraf = window.Targygraf || {}, window.jQuery, window));



window.jQuery(document).ready(function() {

	window.Targygraf.init();
});
