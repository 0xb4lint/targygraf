<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class WebhookController extends Controller
{
    public function postWebhook(Request $request)
    {
        if ($request->input('ref') != 'refs/heads/master') {
            return response()->json('not my business');
        }

        $postData = file_get_contents('php://input');
        $signature = hash_hmac('sha1', $postData, env('GITHUB_WEBHOOK_SECRET'));

        if ($request->server('HTTP_X_HUB_SIGNATURE') != 'sha1=' . $signature) {
            throw new Exception('invalid webhook secret');
        }

        $cwd = base_path();
        $env = [
            'PATH'          => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'COMPOSER_HOME' => '/tmp/composer'
        ];

        $gitPullProcess = new Process('git pull origin master', $cwd, $env);
        $gitPullProcess->mustRun();

        $rmComposerLockProcess = new Process('rm composer.lock', $cwd, $env);
        $rmComposerLockProcess->run();

        $composerInstallProcess = new Process('composer install --no-dev --no-interaction', $cwd, $env);
        $composerInstallProcess->mustRun();

        $phpArtisanMigrateRefreshSeedProcess = new Process('php artisan migrate:refresh --seed -vvv', $cwd, $env);
        $phpArtisanMigrateRefreshSeedProcess->mustRun();

        return response()->json('success');
    }
}
