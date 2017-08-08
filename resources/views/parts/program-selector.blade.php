<div class="program-selector">
	@if ( isset($hidden) )
		<div class="toggle">&nbsp;&nbsp;SZAKVÁLASZTÓ&nbsp;&nbsp;</div>
	@endif
	<div class="faculties"{!! isset($hidden) ? ' style="display: none;"' : '' !!}>
		@foreach ($university->faculties as $faculty)
			<div class="faculty">
				<div class="faculty-name">{{ $faculty->name }}</div>
				@foreach ($faculty->programs as $_program)
					<a href="{{ route('program', ['university' => $university, 'program' => $_program]) }}" class="program{{ isset($program) && $program->id == $_program->id ? ' active' : '' }}">
						{{ $_program->name }}
					</a>
				@endforeach
			</div>
		@endforeach
	</div>
</div>
