<?php

namespace Tests\Feature\Json;

use Tests\TestCase;
use Illuminate\Foundation\Testing\WithoutMiddleware;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\DatabaseTransactions;

abstract class JsonTest extends TestCase
{
    protected $directory = 'json/universities';

    public function testDirectoryExists()
    {
        $this->assertTrue(is_dir(base_path($this->directory)));
    }



    public function testJsonExtensions()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] != '.') {
                $this->assertTrue(ends_with($file, '.json'), $file);
            }
        }
    }



    public function testValidJsonFiles()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] != '.') {
                $this->assertNotNull(json_decode(file_get_contents(base_path($this->directory . '/' . $file))), $file);
            }
        }
    }
}
