<div class="content" data-specialis="0">
	@foreach ($program->courseBlocks->where('row', 0) as $courseBlock)
		@include('parts.course-block')
	@endforeach
</div>

@if (($specialBlocks = $program->courseBlocks->where('row', 1)) && !$specialBlocks->isEmpty())
	<div class="content" data-specialis="1">
		@foreach ($program->courseBlocks->where('row', 1) as $courseBlock)
			@include('parts.course-block')
		@endforeach
	</div>
@endif

@if (($special2Blocks = $program->courseBlocks->where('row', 2)) && !$special2Blocks->isEmpty())
	<div class="content" data-specialis="1">
		@foreach ($program->courseBlocks->where('row', 2) as $courseBlock)
			@include('parts.course-block')
		@endforeach
	</div>
@endif
