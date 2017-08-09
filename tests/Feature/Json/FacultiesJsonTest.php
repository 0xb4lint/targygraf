<?php

namespace Tests\Feature\Json;

class FacultiesJsonTest extends AbstractJsonTest
{
    protected $directory = 'json/faculties';
    protected $universitiesDirectory = 'json/universities';

    public function testUniversityExists()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] != '.') {
                $fileParts = explode('_', pathinfo($file, PATHINFO_FILENAME));
                $this->assertTrue(file_exists(base_path($this->universitiesDirectory.'/'.$fileParts[0].'.json')), $file);
            }
        }
    }
}
