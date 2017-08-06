@extends('template')

@section('content')
	<?php $lastRow = 0; ?>
	@foreach ($universities as $university)
		@if ($lastRow != $university->row)
			<br>
			<?php $lastRow = $university->row; ?>
		@endif
		<a href="{{ route('university', ['university' => $university]) }}" class="uni{{ !$university->has_logo ? ' uni-no-cimer' : '' }}">
			<div class="uni-cimer-cont">
				<div class="uni-cimer-helper"></div>
				@if ($university->has_logo)
					<img src="{{ url('assets/img/logo/' . $university->slug . '.svg') }}" alt="{{ $university->name }}" class="uni-cimer">
				@else
					<div class="uni-cimer-alt">{{ strtoupper($university->slug) }}</div>
				@endif
			</div>
			<div class="uni-nev">{{ $university->name }}</div>
		</a>
	@endforeach
@stop
