<?php

namespace Tests\Database;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseMigrations;

class SeedTest extends TestCase
{
    use DatabaseMigrations;

    public function testSeed()
    {
        $this->artisan('db:seed');
    }
}
