@extends('template')

@section('gombok')

	<a href="{{ route('index') }}" class="gomb" title="targygraf.hu"><i class="fa fa-fw fa-home"></i></a>

@stop

@section('dark')

	@if ($university->has_logo)
		<img id="cimer" src="{{ url('assets/img/logo/' . $university->slug . '.svg') }}">
	@endif

	<div id="list">
		@include('parts.programs')
	</div>

@stop
