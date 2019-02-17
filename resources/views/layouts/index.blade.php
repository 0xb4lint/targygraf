@extends('template')

@section('header')
	<div class="fb-like" data-href="https://www.facebook.com/targygraf" data-layout="standard" data-action="recommend" data-show-faces="true" data-share="false"></div>
@stop

@section('main')
	<h1>Tárgygráf</h1>
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

@section('footer')
	<ins class="adsbygoogle" data-ad-client="ca-pub-6543577519725877" data-ad-slot="8295171039" data-ad-format="auto" data-full-width-responsive="true"></ins>
	<script>
		(adsbygoogle = window.adsbygoogle || []).push({});
	</script>
@stop
