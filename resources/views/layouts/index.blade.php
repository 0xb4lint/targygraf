@extends('template')

@section('header')
	<div class="fb-like" data-href="https://www.facebook.com/targygraf" data-layout="standard" data-action="recommend" data-show-faces="true" data-share="false"></div>
@stop

@section('main')
	<?php $lastRow = 0; ?>
	@foreach ($universities as $university)
		@if ($lastRow != $university->row)
			<br>
			<?php $lastRow = $university->row; ?>
		@endif
		<a href="{{ route('university', ['university' => $university]) }}" class="university">
			<div class="logo" style="background-image:url('{{ url('assets/img/logo/' . $university->slug . '.svg') }}')">
				@if (!$university->has_logo)
					{{ strtoupper($university->slug) }}
				@endif
			</div>
			<div class="name">{{ $university->name }}</div>
		</a>
	@endforeach
@stop
