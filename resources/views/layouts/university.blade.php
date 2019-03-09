@extends('template')

@section('buttons')
	<a href="{{ env('APP_URL') }}" class="button" title="targygraf.hu"><i class="fa fa-home"></i></a>
@stop

@section('header')
	@include('parts.program-selector')
@stop

@section('main')
	@if ($university->has_logo)
		<img class="university-logo" src="{{ url('assets/img/logo/' . $university->slug . '.svg') }}">
	@endif

	<h1>{{ $university->name }}</h1>

	<div class="fb-page" data-href="https://www.facebook.com/targygraf" data-small-header="true" data-adapt-container-width="true" data-hide-cover="true" data-show-facepile="true"><blockquote cite="https://www.facebook.com/targygraf" class="fb-xfbml-parse-ignore"><a href="https://www.facebook.com/targygraf">Tárgygráf</a></blockquote></div>
@stop
