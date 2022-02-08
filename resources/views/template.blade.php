<!DOCTYPE html>
<html lang="hu">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="keywords" content="tárgygráf, pannon egyetem, pe, bme, pte, pécs, műszaki, műegyetem, tanterv, mintatanterv, egyetem, pannon, gráf, kredit, félév, tárgyak, tárgy, tantárgy, előfeltétel, előtanulmány, előtanulmányi rend, ráépülés">
		<meta name="description" content="{{ @$htmlDescription ?: 'Interaktív tanulmányi előrehaladás vizualizáció' }}">
		<title>{{ isset($htmlTitle) ? $htmlTitle . ' | ' : '' }}Tárgygráf</title>
		<meta property="og:title" content="{{ isset($htmlTitle) ? $htmlTitle . ' | ' : '' }}Tárgygráf">
		<meta property="og:description" content="{{ @$htmlDescription ?: 'Interaktív tanulmányi előrehaladás vizualizáció' }}">
		<meta property="og:image" content="{{ url('assets/img/cimer/' . (@$cimer ?: 'targygraf') . '_small.png') }}">
		<meta property="og:type" content="website">
		<meta property="fb:admins" content="1412307634">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<link rel="icon" type="image/png" href="{{ url('icon.png') }}">
		<link rel="apple-touch-icon" href="{{ url('icon.png') }}">
		<link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400&amp;subset=cyrillic,cyrillic-ext,greek,greek-ext,latin-ext,vietnamese" rel="stylesheet">
		<link href="https://netdna.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
		<link href="{{ url('assets/css/style.css') }}?v=20190217" rel="stylesheet">
		<link href="{{ url('assets/css/tipsy.css') }}" rel="stylesheet">
		<link href="{{ url('assets/css/notie.min.css') }}" rel="stylesheet">
		<script type="text/javascript">
		(function(d, s, id) {
			var js, fjs = d.getElementsByTagName(s)[0];
			if (d.getElementById(id)) return;
			js = d.createElement(s); js.id = id;
			js.src = "//connect.facebook.net/hu_HU/sdk.js#xfbml=1&version=v2.10&appId=233475786671363";
			fjs.parentNode.insertBefore(js, fjs);
		}(document, 'script', 'facebook-jssdk'));

			(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
				(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
				m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
			})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

			ga('create', 'UA-3084378-17', 'targygraf.hu');
			ga('send', 'pageview');
		</script>
	</head>
	<body>
		<div id="fb-root"></div>

		<div class="fade"></div>

		<div class="buttons">
			@yield('buttons')
		</div>

		<header>
			@yield('header')
		</header>

		<main>
			@yield('main')
		</main>

		<footer>
			@yield('footer')
			<iframe src="https://ghbtns.com/github-btn.html?user=0xb4lint&repo=targygraf&type=star&count=true&size=large" class="github"></iframe>
			<div class="disclaimer">Az oldalon található információk nem tekinthetőek hivatalos forrásnak.</div>
		</footer>

		<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
		<script src="{{ url('assets/js/jquery.tipsy.min.js') }}"></script>
		<script src="{{ url('assets/js/notie.min.js') }}"></script>
		<script src="{{ url('assets/js/targygraf.js') }}?v=20190625"></script>
		@yield('scripts')
	</body>
</html>
