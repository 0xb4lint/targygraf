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
            if ($file[0] == '.') {
                continue;
            }

            $fileParts = explode('_', pathinfo($file, PATHINFO_FILENAME));
            $universityFilePath = $this->universitiesDirectory.'/'.$fileParts[0].'.json';

            $this->assertTrue(file_exists(base_path($universityFilePath)), $file);
        }
    }

    protected function checkJsonStructure($path)
    {
        $data = json_decode(file_get_contents(base_path($path)));

        $this->assertTrue(
            is_string($data->name),
            $path.' name is_string'
        );

        $this->assertTrue(
            is_int($data->ordering),
            $path.' ordering is_int'
        );

        $this->assertGreaterThanOrEqual(
            0,
            $data->ordering,
            $path.' ordering'
        );
    }
}
