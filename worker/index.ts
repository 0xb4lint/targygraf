import universities from './universities.generated.json';
import { route } from './routing';

interface Fetcher {
	fetch(request: Request): Promise<Response>;
}

interface Env {
	ASSETS: Fetcher;
	BASE_DOMAIN?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const decision = route(url, env.BASE_DOMAIN || 'targygraf.hu', universities);

		if (decision.kind === 'redirect') {
			return Response.redirect(decision.location, 301);
		}

		const assetUrl = new URL(url);
		assetUrl.pathname = decision.assetPath;
		return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
	},
};
