<?php

namespace Tests\Database;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Tests\TestCase;

class SeedTest extends TestCase
{
    use DatabaseMigrations;

    public function testSeed()
    {
        $this->artisan('db:seed')->assertExitCode(0);
    }
}
