<div class="content" data-specialis="0">
	@foreach ($program->courseBlocks->where('row', 0) as $courseBlock)
		@include('parts.course-block')
	@endforeach
</div>

<ins class="adsbygoogle" data-ad-client="ca-pub-6543577519725877" data-ad-slot="5243903221" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>
	(adsbygoogle = window.adsbygoogle || []).push({});
</script>

@if (($specialBlocks = $program->courseBlocks->where('row', 1)) && !$specialBlocks->isEmpty())
	<div class="content" data-specialis="1">
		@foreach ($program->courseBlocks->where('row', 1) as $courseBlock)
			@include('parts.course-block')
		@endforeach
	</div>
@endif
