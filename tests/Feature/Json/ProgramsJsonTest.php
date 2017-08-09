<?php

namespace Tests\Feature\Json;

class ProgramsJsonTest extends AbstractJsonTest
{
    protected $directory = 'json/programs';
    protected $facultiesDirectory = 'json/faculties';

    public function testFacultyExists()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] != '.') {
                $fileParts = explode('_', pathinfo($file, PATHINFO_FILENAME));
                $this->assertTrue(file_exists(base_path($this->facultiesDirectory.'/'.$fileParts[0].'_'.$fileParts[1].'.json')), $file);
            }
        }
    }
}
