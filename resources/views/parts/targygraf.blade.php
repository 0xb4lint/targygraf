<?php $semesterSeparator = false; ?>
<div class="content" data-specialis="0">
@foreach ($program->courseBlocks as $courseBlock)

	@if ( !$courseBlock->is_semester && !$semesterSeparator )
		</div>
		<div class="content" data-specialis="1">
		<?php $semesterSeparator = true; ?>
	@endif

	<?php $sumCredits = 0; ?>
	<div class="course-block"
		data-id="{{ $courseBlock->getPaddedID() }}"
		data-is-counted="{{ $courseBlock->is_counted }}">
		<div class="course-block-title">{{ $courseBlock->getName() }}</div>
		@foreach ($courseBlock->courses as $course)
			<?php $sumCredits += $course->credits; ?>

			@if ($course->code == '______')
				<hr>
			@else
				<div class="course"
					title="{{{ $course->getTitle() }}}"
					data-id="{{ $course->getPaddedID() }}"
					data-code="{{ $course->code }}"
					data-credits="{{ $course->credits }}"
					data-referenced-course-blocks="{{ implode(',', $course->getCourseBlockReferencesIDs()) }}"
					data-prerequisites="{{ implode(',', $course->getPrerequisitesIDs()) }}">
					{{ $course->name }}
				</div>
			@endif
			@endforeach

		@if ( $courseBlock->is_semester && $sumCredits )
		<div class="muted">
			∑ {{ $sumCredits }} kredit
		</div>
		@endif

	</div>
@endforeach
</div>
