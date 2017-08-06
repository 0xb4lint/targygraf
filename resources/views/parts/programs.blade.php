<div id="szakok"{{ isset($hidden) ? ' style="display: none;"' : '' }}>
@foreach ($university->faculties as $faculty)
	<div class="kar">
		<div class="kar-title">{{ $faculty->name }}</div>
		@foreach ($faculty->programs as $program)
			<a href="{{ route('program', ['university' => $university, 'program' => $program]) }}">
				{{ $program->name }}
			</a>
		@endforeach
	</div>
@endforeach
</div>
