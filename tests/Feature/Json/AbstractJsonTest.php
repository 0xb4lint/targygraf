<?php

namespace Tests\Feature\Json;

use Tests\TestCase;

abstract class AbstractJsonTest extends TestCase
{
    protected $directory = 'json/universities';

    abstract protected function checkJsonStructure($path);

    public function testDirectoryExists()
    {
        $this->assertTrue(is_dir(base_path($this->directory)));
    }

    public function testJsonExtensions()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] == '.') {
                continue;
            }

            $this->assertTrue(ends_with($file, '.json'), $file);
        }
    }

    public function testValidJsonFiles()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] == '.') {
                continue;
            }

            $this->assertNotNull(json_decode(file_get_contents(base_path($this->directory.'/'.$file))), $file);
        }
    }

    public function testJsonStructures()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] == '.') {
                continue;
            }

            $this->checkJsonStructure($this->directory.'/'.$file);
        }
    }
}
